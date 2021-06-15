const converter = require('hex2dec');
const mysql = require("mysql");

const moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");
var request = require('request');

const pool = require('./connectionPool');
const queryConfig = require('./query/configQuery')

const bleserver = {
    beaconList: [],
    beaconData: {
        // [비콘맥주소]:{
        //     input_time: null,
        //     timestamp: null,
        //     type:'',
        //     mac:'',
        //     uuid:,
        //     major:,
        //     minor:,
        //     rssi:,
        //     txpower:,
        //     battery:,
        //     battery_timestamp:,
        //     rawData:,
        //     scann:[]
        // },
    },
    scannerGroup: {
        // 'AC233FC06681': 'A1',
        // 'AC233FC066C8': 'A1',
        // 'AC233FC02CF6': 'C1',
        // 'AC233FC00458': 'C1',
    },
    emergency: {
        // [beaconmac]:{
        //     start_time: undefined,
        // }
    },
    init() {
        const _this = this;
        _this.getBeacon();
        _this.getScanner();
    },
    getBeacon() {
        const _this = this;
        const _query = queryConfig.findByAll('info_beacon_view');

        pool.getConnection((err, connection) => {
            if (err) {

            } else {
                connection.query(_query, (err, results, field) => {
                    if (err) {
                        connection.release();
                    } else {
                        // const obj = results.reduce((obj, cur) => {
                        //     // obj[cur.bc_index] = cur;
                        //     if (_this.beaconList.indexOf(cur.bc_address) === -1) {
                        //         obj.push(cur.bc_address)
                        //     }
                        //     return obj;
                        // }, []);
                        // _this.beaconList = [
                        //     ..._this.beaconList,
                        //     ...obj
                        // ];

                        const obj = results.map(item => {
                            const _mac = item.bc_address;
                            const isMac = _this.beaconData.hasOwnProperty(_mac)
                            if (isMac) {
                                if (item.bc_used_type !== 0) {
                                    _this.beaconData = {
                                        ...this.beaconData,
                                        [_mac]: {
                                            ..._this.beaconData[_mac],
                                            ...item
                                        }
                                    }
                                } else {
                                    // _this.beaconData.remove(_mac);
                                    // _this.outBeacon(_this.beaconData[_mac]);
                                    delete _this.beaconData[_mac];
                                }
                            } else {
                                if (item.bc_used_type !== 0) {
                                    _this.beaconData = {
                                        ...this.beaconData,
                                        [_mac]: {
                                            ...item,
                                            scann: [],
                                            log: [],
                                            prev_location: null
                                        }
                                    }
                                }
                            }

                            return item;
                        });

                    }
                });
                connection.release();
            }
        });

    },
    getScanner() {
        const _this = this;
        const _query = queryConfig.findByAll('info_scanner');

        pool.getConnection((err, connection) => {
            if (err) {

            } else {
                connection.query(_query, (err, results, field) => {
                    if (err) {

                    } else {
                        const obj = results.reduce((obj, cur) => {
                            obj[cur.scn_address] = cur.scn_group;
                            return obj;
                        }, {});
                        _this.scannerGroup = obj;
                        // console.log(_this.scannerGroup)
                    }
                });
                connection.release();
            }

        });
    },
    receive(receiveData, scanner) {
        const _this = this;
        let _beaconData = _this.beaconData;
        for (let idx in receiveData) {
            const recBeacon = receiveData[idx];
            const { type, mac } = recBeacon
            // if (recBeacon.mac.indexOf('85F2') > -1 || recBeacon.mac.indexOf('21B9') > -1) {

            if (_this.beaconData.hasOwnProperty(mac) && Object.keys(_this.scannerGroup).includes(scanner)) {
                // Unknown= 배터리/3축정보 
                if (type !== 'Unknown') {
                    _this.receiveHandler(recBeacon, scanner)
                } else {
                    // Unknown == true
                    const { rawData } = recBeacon;
                    if (rawData) {
                        _this.unKnownHandler(recBeacon);
                    }

                }
            }
        }
        // console.log(_this.beaconData)
    }, // end receive Fncs
    receiveHandler(data, scanner) {
        const _this = this;
        // console.log(_this.scannerGroup)
        const {
            type, timestamp,
            mac, ibeaconUuid,
            ibeaconMajor, ibeaconMinor,
            rssi, ibeaconTxPower
        } = data;
        // console.log('ibeaconMinor-->>>>>', ibeaconMinor)
        const isMacProperty = _this.beaconData.hasOwnProperty(mac);
        if (isMacProperty) {
            // 1번 이상 수신 된적 있음
            clearTimeout(_this.beaconData[mac].intervalID)
            _this.beaconData = {
                ...this.beaconData,
                [mac]: {
                    ...this.beaconData[mac],
                    timestamp,
                    type,
                    mac,
                    scanner,
                    uuid: ibeaconUuid,
                    major: ibeaconMajor,
                    minor: ibeaconMinor,
                    rssi: rssi,
                    txpower: ibeaconTxPower,
                    scann: [
                        ..._this.beaconData[mac]['scann'],
                        {
                            group: _this.scannerGroup[scanner],
                            rssi: Math.abs(rssi) < 90 ? rssi : 0
                        }
                    ],
                    log: [
                        ..._this.beaconData[mac]['log'],
                        Math.abs(rssi) < 90 ? _this.scannerGroup[scanner] : null
                    ],
                    intervalID: setTimeout(() => {
                        console.log('OUT!!!!!!')
                        _this.outBeacon(_this.beaconData[mac])
                    }, 15000)
                }
            }

            const scannLength = _this.beaconData[mac].scann.length;
            if (scannLength >= 5) {

                const location = _this.getLocation(_this.beaconData[mac])
                console.log('location--->', location)
                _this.beaconData[mac].location = location;

                _this.inputBeacon(_this.beaconData[mac])
                // 그룹 체크   
                _this.beaconData[mac].scanner = null;

                // 수신 스캐너 그룹 초기화
                _this.beaconData[mac].scann = [];
                _this.beaconData[mac].log = [];
            }

        } else {
            // 처음 수신
            // _this.beaconData = {
            //     ..._this.beaconData,
            //     [mac]: {
            //         input_time: timestamp,
            //         timestamp,
            //         type,
            //         mac,
            //         uuid: ibeaconUuid,
            //         major: ibeaconMajor,
            //         minor: ibeaconMinor,
            //         rssi,
            //         txpower: ibeaconTxPower,
            //         battery: 0,
            //         battery_timestamp: null,
            //         rawData: null,
            //         scann: [
            //             {
            //                 group: _this.scannerGroup[scanner],
            //                 rssi: Math.abs(rssi) < 90 ? rssi : 0
            //             }
            //         ],
            //         log: [
            //             Math.abs(rssi) < 90 ? _this.scannerGroup[scanner] : null
            //         ],
            //         intervalID: undefined
            //     }
            // }
            return
        }
    },
    unKnownHandler(data) {
        const _this = this;
        const { timestamp, mac, rawData } = data;
        const structureLeng = rawData.substring(0, 2); //First AD structure length
        const dataType = rawData.substring(2, 4);  // Data type
        const idCode = rawData.substring(4, 10);  // Wellcore ID Code: cc2640:C64 nrf51822:n51 cc2541:,sqc
        const Xaxis = rawData.substring(10, 12); // X축
        const Xaxis_dec = converter.hexToDec(`0x${Xaxis}`)
        const Yaxis = rawData.substring(12, 14); // Y축
        const Yaxis_dec = converter.hexToDec(`0x${Yaxis}`)
        const Zaxis = rawData.substring(14, 16); // Z축
        const Zaxis_dec = converter.hexToDec(`0x${Zaxis}`)

        const bettery = rawData.substring(20, 22); // Battery level data(100%)
        const bettery_dec = converter.hexToDec(`0x${bettery}`)


        // beaconData에 처음 수신
        _this.beaconData = {
            ..._this.beaconData,
            [mac]: {
                ..._this.beaconData[mac],
                x_axis: Number(Xaxis_dec),
                y_axis: Number(Yaxis_dec),
                z_axis: Number(Zaxis_dec),
                battery: Number(bettery_dec),
                battery_timestamp: timestamp,
                rawData: rawData,
            }
        }
    },
    getLocation(data) {
        const { scann, mac } = data;
        //** Rssi 연산 */
        // #1 그룹별 RSSI 합 구하기
        let totalRssi = 0;
        let avrRssi = scann.reduce((acc, curr) => {
            const { group, rssi } = curr;
            const absRssi = 100 + rssi;
            acc[group] = acc[group] ? acc[group] + absRssi : absRssi;
            totalRssi += absRssi;
            return acc;
        }, {});

        // #2 그룹별 RSSI 평균 구한 후 0.6의 가중치(60%)
        for (let keys in avrRssi) {
            const percent = (avrRssi[keys] / totalRssi) * 100;
            const result = percent * 0.6;
            avrRssi = {
                ...avrRssi,
                [keys]: result
            };
        }
        console.log("01.avrArr-->", avrRssi);

        //** 빈도 수 연산 */
        // #1.내림차순 정렬
        const sortArr = scann.sort((next, prev) => {
            const PrevRssi = prev.rssi;
            const NextRssi = next.rssi;
            if (NextRssi < PrevRssi) return 1;
            if (NextRssi > PrevRssi) return -1;
            if (NextRssi === PrevRssi) return 0;
            return false;
        });
        // #2. 마지막 데이터 삭제
        const splitArr = sortArr.slice(0, sortArr.length - 1);

        // #3. 그룹 빈도 수 구하기
        let counts = splitArr.reduce((acc, curr) => {
            const { group, rssi } = curr;
            acc[group] = (acc[group] || 0) + 1;
            return acc;
        }, {});

        // #4. 빈도 값 계산
        // #4-1 최솟값을 제외한 배열 길이
        const splitLeng = splitArr.length;

        // #4-2 그룹별 수신 비율 계산 가중치 0.4 (40%)
        let resultGroup = {};
        for (let key in counts) {
            const result = (counts[key] / splitLeng) * 100 * 0.4;
            console.log(result);
            resultGroup[key] = result + avrRssi[key];
        }
        console.log("resultGroup-->", resultGroup);

        // #5 resultGroup(counts[key]+avrRssi[key]) 객체 비교 중 최댓값 추출
        const keys = Object.keys(resultGroup);
        let mode = keys[0];
        keys.forEach((val, idx) => {
            if (resultGroup[val] > resultGroup[mode]) {
                mode = val;
            }
        });
        console.log(mode);

        return mode

    },
    inputBeacon(data) {
        const _this = this;
        const {
            input_time, timestamp, type, mac, uuid,
            major, minor, rssi,
            battery, battery_timestamp,
            log, location, prev_location, scanner,
            x_axis, y_axis, z_axis,
            txpower: tx_power,
            rawData: rawdata
        } = data;
        let _alarmState = minor;
        if (minor === 2) {
            const isMacProperty = this.emergency.hasOwnProperty(mac);
            console.log('emergency---->>>>>>>', isMacProperty)
            if (isMacProperty) {
                // 변경
                // delete this.emergency[mac];
                _alarmState = 1;
                return;
            } else {
                // 처음 등록
                this.emergency = {
                    ...this.emergency,
                    [mac]: {
                        date: timestamp,
                        minor,
                    }
                }
                _this.getSOSWorkerInfo(mac);
            }
        } else {
            // minor === 1
            const isMacProperty = this.emergency.hasOwnProperty(mac);
            if (isMacProperty) {
                // minor: 2--->1 정상으로 돌아옴
                delete this.emergency[mac];
            }

        }

        const _query = queryConfig.insert('log_beacon');
        const insertData = {
            input_time: moment().format('YYYY-MM-DD HH:mm:ss'),
            timestamp: timestamp,
            type,
            mac,
            uuid,
            major,
            minor: _alarmState,
            rssi,
            tx_power,
            log: JSON.stringify(log),
            scanner,
            location,
            x_axis,
            y_axis,
            z_axis,
            battery,
            battery_timestamp: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
            rawdata
        };
        // if(prev_location===null || prev_location !== location){
        //     if(prev_location !== location){
        //         _this.outBeacon(data);
        //     }   
        //     _this.beaconData[mac].prev_location = location;
        // }

        pool.getConnection((err, connection) => {
            if (err) {
                console.error(err)
            } else {
                connection.query(_query, insertData, (err, results, field) => {
                    if (err) {
                        console.error(err)
                    } else {
                        // console.log(results);

                        //log_ble_io 테이블에 insert
                        if (!_this.beaconData[mac].ble_input_time) {
                            const logData = {
                                ble_input_time: insertData.input_time,
                                bc_address: insertData.mac,
                                sc_group: data.location,
                                bc_used_type: data.bc_used_type,
                                name: data.bc_used_type === 1 ? data.wk_name : data.vh_name,
                                co_name: data.bc_used_type === 1 ? data.wk_co_name : data.vh_co_name,
                                nation: data.bc_used_type === 1 ? data.wk_nation : null,
                                position: data.bc_used_type === 1 ? data.wk_position : null,
                                number: data.bc_used_type === 1 ? data.wk_phone : data.vh_number,
                            }
                            _this.bleLogInsert(logData);
                        }
                    }
                });
            }
            connection.release();
        })
    },
    bleLogInsert(data) {
        const _this = this;
        const _query = `INSERT INTO log_ble_io SET ?;`;

        const insertData = {
            ble_input_time: data.ble_input_time,
            bc_address: data.bc_address,
            sc_group: data.sc_group,
            bc_used_type: data.bc_used_type,
            name: data.name,
            co_name: data.co_name,
            nation: data.nation,
            position: data.position,
            number: data.number
        };


        pool.getConnection((err, connection) => {
            if (err) {
                console.error(err)
            } else {
                connection.query(_query, insertData, (err, results, field) => {
                    if (err) {
                        console.error(err)
                    } else {
                        _this.beaconData = {
                            ..._this.beaconData,
                            [data.bc_address]: {
                                ..._this.beaconData[data.bc_address],
                                ble_input_time: insertData.ble_input_time
                            }
                        }
                    }
                });
            }
            connection.release();
        })
    },
    outBeacon(data) {
        const _this = this;
        const _query = queryConfig.update('info_beacon', 'bc_address');
        const { timestamp, input_time, mac, major, minor, battery, battery_timestamp } = data;
        const _updateData = {
            bc_input_time: null,
            bc_out_time: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
            bc_io_state: 'o',
            battery_remain: battery,
            battery_time: battery_timestamp
        }
        const UpdataData = [];
        UpdataData[0] = _updateData;
        UpdataData[1] = mac
        pool.getConnection((err, connection) => {
            if (err) {
                console.error(err)
            } else {
                connection.query(_query, UpdataData, (err, results, field) => {
                    if (err) {
                        console.error(err)
                    } else {
                        delete _this.beaconData[mac];
                    }
                });
            }
            connection.release();
        })

    },
    getSOSWorkerInfo(data) {
        const _this = this;
        const _query = `SELECT * FROM ble_input_beacon_view WHERE bc_address="${data}";`;
        pool.getConnection((err, connection) => {
            if (err) {
                console.error(err)
            } else {
                connection.query(_query, (err, results, field) => {
                    if (err) {
                        console.error(err)
                    } else {
                        console.log(results);
                        if (results[0].wk_id !== null) {
                            _this.insertEmergency(results[0]);
                        } else {
                            return;
                        }
                        _this.getAlarmWorkerInfo(results[0]);
                    }
                });
            }
            connection.release();
        })
    },
    getAlarmWorkerInfo(sosData) {
        const _this = this;
        const _query = `SELECT * FROM info_worker_view WHERE wk_sms_yn=1;`;
        pool.getConnection((err, connection) => {
            if (err) {
                console.error(err)
            } else {
                connection.query(_query, (err, results, field) => {
                    if (err) {
                        console.error(err)
                    } else {
                        let reqData = [];
                        results.map(item => {
                            const _data = {
                                destPhone: item.wk_phone,
                                location: sosData.local_name,
                                companyName: sosData.wk_co_name,
                                name: sosData.wk_name,
                                phone: sosData.wk_phone
                            }
                            reqData.push(_data);
                            return item;
                        });
                        _this.alarmHandler(reqData);
                    }
                });
            }
            connection.release();
        })
    },
    alarmHandler(reqData) {
        const _this = this;
        const posturl = 'http://119.207.78.144:8099/alarm/amons/sos';
        // const reqData = {
        //     destPhone: "010-9194-6506",
        //     location: "함양종점",
        //     companyName: "오픈웍스",
        //     name: "이동훈",
        //     phone: "01091946500"
        // }
        request.post({
            url: posturl,
            body: reqData,
            json: true
        }, (error, response, body) => {
            console.error('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.s
        });
    },
    insertEmergency(data) {
        const _query = queryConfig.insert('log_emergency');
        const insertData = {
            emg_start_time: moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
            bc_address: data.bc_address,
            scn_group: data.sc_group,
            wk_name: data.wk_name,
            wk_birth: data.wk_birth,
            wk_phone: data.wk_phone,
            wk_co_name: data.wk_co_name,
            local_index: data.local_index,
            local_name: data.local_name

        };

        pool.getConnection((err, connection) => {
            if (err) {
                console.error(err)
            } else {
                connection.query(_query, insertData, (err, results, field) => {
                    if (err) {
                        console.error(err)
                    } else {
                        console.log(results);
                    }
                });
            }
            connection.release();
        })
    }

}


module.exports = bleserver;