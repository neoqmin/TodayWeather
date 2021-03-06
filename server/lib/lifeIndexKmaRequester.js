/**
 * Created by aleckim on 2015. 10. 14..
 *
 * 자외선 uv 지수(3월~11월), 7시 19시 발표 오늘,내일, 모레까지 위험(11이상), 매우높음(8이상), 높음(6이상), 보통(3이상), 낮음(0)
 * 체감온도(11월~3월), 6시 발표 3시간~66시간까지 -45(위험), -25~45(경고), -10~-25(주의), 관심(~10)
 * 감기 (9월~4월) 6시, 18시에 오늘, 내일, 모레까지 발표됨, 매우높음(3), 높음(2), 보통(1), 낮음(0)
 * 식중독 fsn (3월~11월) 6시, 18시에 오늘, 내일, 모레까지 발표됨., 위험(95), 경고(70), 주의(35), 관심(35)
 * 불쾌지수(6월~9월), 3시 발표 3시간~66시간까지 80이상(매우높음), 75이상(높음), 68이상(보통), 60미만(낮음)
 */

"use strict";
var req = require('request');
var async = require('async');

var Town = require('../models/town');
var LifeIndexKma = require('../models/lifeIndexKma');
var kmaTimeLib = require('../lib/kmaTimeLib');

//var config = require('../config/config');

//var DOMAIN_KMA_INDEX_SERVICE = "http://openapi.kma.go.kr";
var DOMAIN_KMA_INDEX_SERVICE = "http://203.247.66.146";
var PATH_RETRIEVE_LIFE_INDEX_SERVICE = "iros/RetrieveLifeIndexService";

/**
 * fsn 식중독지수, rot 부패지수, Sensorytem 체감온도, Frostbite 동상가능 지수, Heat 열, Dspls 불쾌
 * Winter 동파, Ultrv 자외선, Airpollution 대기 확산
 * _areaList(townList), nextTime - 데이터를 가지고 올 다음 시간, areaIndex - 다음에 가지고올 순서,
 * @constructor
 */
function KmaIndexService() {
    this.serviceKey = "";
    this._areaList = [];

    this.fsn = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 2, end: 10}, //3~11
        updateTimeTable: [5, 20],   //kr 06, 18
        urlPath: 'getFsnLifeList'
    };

    this.rot = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 2, end: 10}, //3~11
        updateTimeTable: [3, 6, 9, 12, 15, 18, 21],   //per 3hours
        urlPath: 'getRotLifeList'
    };

    this.sensorytem = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 10, end: 3}, //3~11
        updateTimeTable: [3, 6, 9, 12, 15, 18, 21],   //per 3hours
        urlPath: 'getSensorytemLifeList'
    };

     this.frostbite = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 11, end: 1}, //12~2
        updateTimeTable: [3, 6, 9, 12, 15, 18, 21],   //per 3hours
        urlPath: 'getFrostbiteLifeList'
    };

    this.heat = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 5, end: 8}, //6~9
        updateTimeTable: [3, 6, 9, 12, 15, 18, 21],   //per 3hours
        urlPath: 'getHeatLifeList'
    };

    this.dspls = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 5, end: 8}, //6~9
        updateTimeTable: [3, 6, 9, 12, 15, 18, 21],   //per 3hours
        urlPath: 'getDsplsLifeList'
    };

    this.winter = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 11, end: 1},
        updateTimeTable: [3, 6, 9, 12, 15, 18, 21],   //per 3hours
        urlPath: 'getWinterLifeList'
    };

    this.ultrv = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 2, end: 10},
        updateTimeTable: [9, 21], //kr 7, 19
        urlPath: 'getUltrvLifeList'
    };

    this.airpollution = {
        nextTime: null,
        areaIndex: 0,
        offerMonth: {start: 10, end: 4},
        updateTimeTable: [3, 6, 9, 12, 15, 18, 21],   //per 3hours
        urlPath: 'getAirpollutionLifeList'
    };

}

/**
 *
 * @param key
 * @returns {KmaIndexService}
 */
KmaIndexService.prototype.setServiceKey = function(key) {
    this.serviceKey = key;
    log.info('Set KEY!!');
    return this;
};

/**
 *
 */
KmaIndexService.prototype.loadAreaList = function() {
    log.info("LOAD AREA LIST");

    var self = this;
    Town.find({}, function(err, townList) {
        if (err)  {
            log.error("Fail to load townlist");
            return err;
        }
        self._areaList = townList;
        log.info("areaList="+self._areaList.length);
    });
};

/**
 *
 * @param indexName
 * @param time
 * @returns {boolean}
 */
KmaIndexService.prototype.checkGetTime = function (indexName, time) {
  return time >= this[indexName].nextTime;
};

/**
 *
 * @param indexName key
 * @param time next time to get data
 * @returns {KmaIndexService}
 */
KmaIndexService.prototype.setNextGetTime = function(indexName, time) {
    var l = this[indexName];

    if (time) {
        l.nextTime = time;
    }
    else {
        var i;
        for (i=0; i< l.updateTimeTable.length; i++) {
            if (l.nextTime.getUTCHours() < l.updateTimeTable[i]) {
                l.nextTime.setUTCHours(l.updateTimeTable[i]);
                break;
            }
        }
        if (i === l.updateTimeTable.length) {
            l.nextTime.setUTCDate(l.nextTime.getUTCDate()+1);
            l.nextTime.setUTCHours(l.updateTimeTable[0]);
        }
        l.nextTime.setUTCMinutes(10);
        l.nextTime.setUTCSeconds(0);
    }

    //check offerMonth
    if (l.offerMonth.start < l.offerMonth.end) {
        // 6~9
        if (l.nextTime.getUTCMonth() < l.offerMonth.start) {
            l.nextTime.setUTCMonth(l.offerMonth.start);
        }
        else if (l.nextTime.getUTCMonth()> l.offerMonth.end) {
            l.nextTime.setUTCFullYear(time.getUTCFullYear()+1);
            l.nextTime.setUTCMonth(l.offerMonth.start);
            l.nextTime.setUTCDate(0);
            l.nextTime.setUTCHours(0);
        }
        else {
            log.silly('continue to get data from kma');
        }
    }
    else {
        //like 10~3
       if (l.nextTime.getUTCMonth() > l.offerMonth.end)  {
           l.nextTime.setUTCMonth(l.offerMonth.start);
           l.nextTime.setUTCDate(0);
           l.nextTime.setUTCHours(0);
       }
    }


    log.info("SET next get "+indexName+" life list time=", this[indexName].nextTime.toString());
    return this;
};

/**
 *
 * @param indexName
 * @param areaNo
 * @param svcKey
 * @returns {string}
 */
KmaIndexService.prototype.getUrl = function (indexName, areaNo, svcKey) {
    var lifeIndex = this[indexName];
    if (!svcKey) {
        svcKey = this.serviceKey;
    }

    var url = DOMAIN_KMA_INDEX_SERVICE + "/" + PATH_RETRIEVE_LIFE_INDEX_SERVICE;
    url += "/" + lifeIndex.urlPath;
    url += "?serviceKey="+svcKey;
    url += "&AreaNo="+areaNo;
    url += "&_type=json";

    return url;
};

/**
 "IndexModel": {
    "code": "A01_2", "areaNo": 5013062000, "date": 2015101818, "today": "", "tomorrow": 55,"theDayAfterTomorrow": 55
  }
 * @param parsedData
 * @param indexModel
 * @private
 */
KmaIndexService.prototype._parseDailyLifeIndex = function (parsedData, indexModel) {

    var lastUpdateDate = ''+indexModel.date;

    var today = kmaTimeLib.convertStringToDate(lastUpdateDate);
    var tomorrowStr = kmaTimeLib.convertDateToYYYYMMDD(today.setDate(today.getDate()+1));
    var tdatStr = kmaTimeLib.convertDateToYYYYMMDD(today.setDate(today.getDate()+1));


    if (indexModel.today !== "") {
        parsedData.data.push({date: lastUpdateDate.substr(0,8), value: indexModel.today});
    }
    else {
        log.silly('skip invalid data of today');
    }

    parsedData.data.push({date: tomorrowStr, value: indexModel.tomorrow});
    parsedData.data.push({date: tdatStr, value: indexModel.theDayAfterTomorrow});
};

/**
 "IndexModel":{"code":"A02","areaNo":5013062000,"date":2015103018,
    "h3":0,"h6":0,"h9":0,"h12":0,"h15":0,"h18":0,"h21":0,"h24":0,"h27":0,"h30":0,"h33":0,"h36":0,"h39":0,"h42":0,
    "h45":0,"h48":1,"h51":3,"h54":3,"h57":"","h60":"","h63":"","h66":""}
 * @param parsedData
 * @param indexModel
 * @private
 */
KmaIndexService.prototype._parseHourlyLifeIndex = function (parsedData, indexModel) {
    var lastUpdateDate = ''+indexModel.date;

    var startTime = kmaTimeLib.convertStringToDate(lastUpdateDate);

    for (var i=3;i<67;i+=3) {
        var propertyName = 'h'+i;
        startTime.setHours(startTime.getHours()+3);

        if (indexModel[propertyName] === '') {
            log.silly('skip invalid data');
            continue;
        }

        var data = {date: kmaTimeLib.convertDateToYYYYMMDD(startTime),
                    time: kmaTimeLib.convertDateToHHMM(startTime),
                    value: indexModel[propertyName]};

        log.silly(data);
        parsedData.data.push(data);
    }
};

/* jshint ignore:start */
/**
 *
     "Response": {
        "Header": {
            "SuccessYN": "Y", "ReturnCode": "00","ErrMsg": "" },
        "Body": {
            "@xsi.type": "idxBody",
            "IndexModel": {}}}
    return - {*|{error: Error, data: {areaNo: String, $indexName: {}}}

 * @param indexName
 * @param data
 * @returns {*}
 */
/* jshint ignore:end */
KmaIndexService.prototype.parseLifeIndex = function(indexName, data) {
    var err;

    if (!data.Response || !data.Response.Header || !data.Response.Header.SuccessYN) {
        err = new Error("Fail to parse LifeList of " + indexName);
        log.error(err);
        return {error: err};
    }

    var header = data.Response.Header;
    if (header.SuccessYN === 'N') {
        if (header.ReturnCode === 99) {
            log.warn("Search result is nothing but continue getting data index="+indexName+" ErrMsg="+header.ErrMsg);
            log.debug(data);
            return {};
        }
        else {
            err = new Error("ReturnCode="+header.ReturnCode+" ErrMsg="+header.ErrMsg);
            log.error(err);
            return {error: err};
        }
    }

    if (!data.Response.Body || !data.Response.Body.IndexModel) {
        err = new Error("We get success but, Fail to parse LifeList of " + indexName);
        log.error(err);
        return {error: err};
    }

    var indexModel = data.Response.Body.IndexModel;

    var areaNo = ''+indexModel.areaNo;
    var lastUpdateDate = ''+indexModel.date;
    var parsedData = {lastUpdateDate: lastUpdateDate, data: []};

    if (indexName === 'fsn' || indexName === 'ultrv') {
        this._parseDailyLifeIndex(parsedData, indexModel);
    }
    else {
        this._parseHourlyLifeIndex(parsedData, indexModel);
    }

    var result = {areaNo: areaNo};
    result[indexName]  = parsedData;
    return {error: undefined, data: result};
};

/**
 *
 * @param indexName
 * @param areaNo
 * @param callback
 */
KmaIndexService.prototype.getLifeIndex = function (indexName, areaNo, callback) {
    var url = this.getUrl(indexName, areaNo, this.serviceKey);

    log.debug(url);

    req(url, {json:true}, function (err, response, body) {
        if (err) {
            return callback(err);
        }
        if (response.statusCode >= 400) {
           return callback(new Error("response status Code="+response.statusCode));
        }
        callback(undefined, body);
    });
};

/**
 *
 * @param indexData
 * @param newData
 * @returns {*}
 */
KmaIndexService.prototype.updateOrAddLifeIndex = function (indexData, newData) {
    indexData.lastUpdateDate = newData.lastUpdateDate;

    var newDataList = newData.data;

    newDataList.forEach(function(newData) {
        for (var i=0; i<indexData.data.length; i++)   {
            if (indexData.data[i].date === newData.date) {
                indexData.data[i].value = newData.value;
                break;
            }
        }

        if (i>=indexData.data.length) {
            indexData.data.push(newData);
        }
    });

    return indexData;
};

/**
 *
 * @param indexName
 * @param town
 * @param data
 * @returns {*|exports|module.exports}
 */
KmaIndexService.prototype.createLifeIndex = function (indexName, town, data) {
    var lifeIndex =  new LifeIndexKma({town: town.town, mCoord: town.mCoord,
                areaNo: data.areaNo});
    lifeIndex[indexName] = data[indexName];

    return lifeIndex;
};

/**
 *
 * @param indexName
 * @param townObject
 * @param data
 * @param callback
 */
KmaIndexService.prototype.saveLifeIndex = function(indexName, townObject, data, callback) {
    var self = this;

    LifeIndexKma.find({areaNo: data.areaNo}, function(err, lifeIndexList) {
        if (err) {
            return callback(err);
        }
        if (lifeIndexList.length === 0) {
            var lifeIndex = self.createLifeIndex(indexName, townObject, data);
            lifeIndex.save(function (err) {
                return callback(err);
            });
            return;
        }

        //If you wants save perfect, have to use promise
        lifeIndexList.forEach(function (lifeIndex) {
            if (lifeIndex[indexName].lastUpdateDate === data[indexName].lastUpdateDate &&
                lifeIndex[indexName].data.length !== 0)
            {
                log.debug(indexName+' life index has not updated yet');
                return;
            }

            self.updateOrAddLifeIndex(lifeIndex[indexName], data[indexName]);
            lifeIndex.save(function (err) {
                if (err) {
                    log.error(err);
                }
            });
        });
        return callback();
    });
};

KmaIndexService.prototype.getLifeIndexByIndexNameAreaNo = function(indexName, town, callback) {
    var self = this;

    async.waterfall([
        function(cb) {
            self.getLifeIndex(indexName, town.areaNo, function(err, body){
                cb(err, body);
            });
        },
        function(rcv, cb) {
            var ret = self.parseLifeIndex(indexName, rcv);
            cb(ret.error, ret.data);
        },
        function(data, cb) {
            if (!data) {
                log.debug('it means skip of ' + indexName);
                return cb();
            }
            self.saveLifeIndex(indexName, town, data, function (err) {
                //todo : need to check save
                if (err) {
                    log.error(err);
                }
            });

            cb(undefined, data[indexName]);
        }
    ], function(err, result) {
        if(err) {
            log.error(err);
        }
        return callback(err, {area: town, indexData: result});
    });
};
/**
 * townList를 돌면서, kma의 데이터를 가지고 와서, parsing하고 save한다, 중간에 오류가 발생하면,
 * town에 대한 index를 저장해서 다음에 index부터 시작한다
 * @param indexName
 * @param callback
 * @returns {*}
 */
KmaIndexService.prototype.taskLifeIndex = function (indexName, callback) {
    var self = this;
    var time = new Date();

    if (!this.checkGetTime(indexName, time)) {
        log.debug('skip '+indexName);
        return callback();
    }

    log.info('start to get '+indexName+' life list ' + time);

    var list = this._areaList.slice(this[indexName].areaIndex);
    log.info(list.length);

    async.mapSeries(list,
        function(area, cBack) {
            self.getLifeIndexByIndexNameAreaNo(indexName, area, function (err, data) {
                cBack(err, data.area);
            });
        },
        function(err, results) {
            if (err) {
                log.error(err);
                self[indexName].areaIndex = self._areaList.indexOf(results[results.length-1].area);
                log.info('next index='+self[indexName].areaIndex);
                return callback(err);
            }
            log.info('get all data of '+indexName);
            self.setNextGetTime(indexName);
            self[indexName].areaIndex = 0;
            callback(err, results);
        });
};

KmaIndexService.prototype.findAreaByTown = function(townInfo, callback) {
    log.info("LOAD town info " +townInfo.toString());

    Town.find({town: townInfo}, function(err, townList) {
        if (err)  {
            log.error("Fail to load townlist");
            return err;
        }
        if (!townList) {
            err = new Error("Fail to find town "+ townInfo.toString());
        }

        var retTown;

        townList.every(function (town) {
           if (!town.areaNo || town.areaNo === '')  {
               log.warn("town didn't have areaNo");
               return true;
           }
            retTown = town;
            return false;
        });

        if (!retTown) {
            err = new Error("Fail to find areaNo "+ townInfo.toString());
            return callback(err);
        }

        log.debug("areaNo="+retTown.areaNo);
        callback(undefined, retTown);
    });
};

KmaIndexService.prototype.getLifeIndexByTown = function(townInfo, callback) {
    log.info("Called KMA Index service By Town");
    if (!this.serviceKey) {
        return log.error("You have to set KEY first!");
    }

    var self = this;
    var list = ['ultrv', 'fsn'];

    //findAreaNo from town
    this.findAreaByTown(townInfo, function (err, town) {
        if (err) {
            return callback(err);
        }

        async.mapSeries(list,
            function(indexName, cb) {
                self.getLifeIndexByIndexNameAreaNo(indexName, town, function (err, data) {
                   cb(err, {indexName:indexName, data: data.indexData});
                });
            },
            function(err, results) {
                if(err) {
                    log.error(err);
                    return callback(err);
                }
                log.silly(results);
                var lifeIndexKma = {town: townInfo, mCoord: town.mCoord, areaNo: town.areaNo};
                results.forEach(function(result) {
                    lifeIndexKma[result.indexName] = result.data;
                });
                return callback(undefined, lifeIndexKma);
            });
    });
};

/**
 * KMA 기상지수는 동시에 가지고 오면 503에러가 발생함
 * @param self
 * @returns {*}
 */
KmaIndexService.prototype.cbMainProcess = function(self, callback) {
    log.info("Called KMA Index service Main process");
    if (!self.serviceKey) {
        return log.error("You have to set KEY first!");
    }

    //SensorytemLife
    //FrostbiteLife
    //WinterLife
    //RotLife
    //HeatLife
    //AirpollutionLife
    var list = ['ultrv', 'fsn'];
    async.mapSeries(list,
        function(indexName, cb) {
            self.taskLifeIndex(indexName, function (err, results) {
                if(err) {
                    log.error(err);
                }
                cb(undefined, results); //keep continue for next index service
            });
        },
        function(err, results) {
            if(err) {
                log.error(err);
            }
            log.silly(results);
            if (callback) {
               callback(err);
            }
            else {
                setTimeout(self.cbMainProcess, 60*1000*10, self); //10mins
            }
        });
};

/**
 *
 */
KmaIndexService.prototype.start = function() {
    log.info('start KMA INDEX SERVICE');
    this.loadAreaList();
    //rot, sensorytem, dspls는 routing시에 계산하여 추가.
    //this.setNextGetTime('rot', new Date());
    //this.setNextGetTime('sensorytem', new Date());
    //this.setNextGetTime('dspls', new Date());
    this.setNextGetTime('fsn', new Date());
    this.setNextGetTime('ultrv', new Date());
    setTimeout(this.cbMainProcess, 3*1000, this); //start after 3secs
};

module.exports = KmaIndexService;

