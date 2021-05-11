const converter = require('hex2dec');

const moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");


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
        const _query = queryConfig.findByAll('info_beacon');

        pool.getConnection((err, connection) => {
            if (err) {

            } else {
                connection.query(_query, (err, results, field) => {
                    if (err) {

                    } else {
                        const obj = results.reduce((obj, cur) => {
                            // obj[cur.bc_index] = cur;
                            obj.push(cur.bc_address)
                            return obj;
                        }, []);
                        _this.beaconList = obj;
                    }
                });
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
                        console.log(_this.scannerGroup)
                    }
                });
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

            if (_this.beaconList.indexOf(mac) > -1) {
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
        const {
            type, timestamp,
            mac, ibeaconUuid,
            ibeaconMajor, ibeaconMinor,
            rssi, ibeaconTxPower
        } = data;

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
            if (scannLength > 5) {

                const location = _this.getLocation(_this.beaconData[mac])
                console.log('location--->', location)
                _this.beaconData[mac].location = location;

                _this.inputReceive(_this.beaconData[mac])
                // 그룹 체크   
                _this.beaconData[mac].scanner = null;

                // 수신 스캐너 그룹 초기화
                _this.beaconData[mac].scann = [];
                _this.beaconData[mac].log = [];
                // console.log(_this.beaconData[mac])
            }

        } else {
            // 처음 수신
            _this.beaconData = {
                ..._this.beaconData,
                [mac]: {
                    input_time: timestamp,
                    timestamp,
                    type,
                    mac,
                    uuid: ibeaconUuid,
                    major: ibeaconMajor,
                    minor: ibeaconMinor,
                    rssi,
                    txpower: ibeaconTxPower,
                    battery: 0,
                    battery_timestamp: null,
                    rawData: null,
                    scann: [
                        {
                            group: _this.scannerGroup[scanner],
                            rssi: Math.abs(rssi) < 90 ? rssi : 0
                        }
                    ],
                    log: [
                        Math.abs(rssi) < 90 ? _this.scannerGroup[scanner] : null
                    ],
                    intervalID: undefined
                }
            }
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
        // console.log('Xaxis->', Xaxis,'--DESC-->',Xaxis_dec)
        // console.log('Yaxis->', Yaxis,'--DESC-->',Yaxis_dec)
        // console.log('Zaxis->', Zaxis,'--DESC-->',Zaxis_dec)
        // console.log('bettery->', bettery,'--DESC-->',bettery_dec)

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

        // #3. 배열 rssi 평균값 구하기
        let avrArr = {};
        let totalRssi = 0;
        let counts = splitArr.reduce((acc, curr) => {
            const { group, rssi } = curr;
            avrArr = {
                ...avrArr,
                [group]: avrArr[group] ? avrArr[group] + rssi : rssi
            };
            acc[group] = (acc[group] || 0) + 1;
            return acc;
        }, {});
        let totalCnt = 0;

        for (let key in avrArr) {
            const count = counts[key];
            console.log('count-->', count)
            const avg = (avrArr[key] / count);
            const divAvg = 100 - Math.abs(avg);
            console.log(divAvg)
            const result = divAvg * 0.6;
            avrArr[key] = result;
            totalCnt = totalCnt + count;
        }
        // #4. 빈도 값 계산
        for (let key in counts) {
            counts[key] = parseInt(((counts[key] / totalCnt) * 100 * 0.4) + avrArr[key], 10);
        }
        const keys = Object.keys(counts);
        // console.log(keys)
        let mode = keys[0];
        keys.forEach((val, idx) => {
            // console.log('--->',counts[mode])
            if (counts[val] > counts[mode]) {
                mode = val;
                // counts = counts[mode]
            }
        });
        return mode
    },
    inputReceive(data) {
        const {
            input_time, timestamp, type, mac, uuid,
            major, minor, rssi,
            battery, battery_timestamp,
            log, location, scanner,
            x_axis, y_axis, z_axis,
            txpower: tx_power,
            rawData: rawdata
        } = data;
        const _query = queryConfig.insert('log_beacon');
        const insertData = {
            input_time,
            timestamp,
            type,
            mac,
            uuid,
            major,
            minor,
            rssi,
            tx_power,
            log: JSON.stringify(log),
            scanner,
            location,
            x_axis,
            y_axis,
            z_axis,
            battery,
            battery_timestamp,
            rawdata
        }
        pool.getConnection((err, connection) => {
            if (err) {
                console.error(err)
            } else {
                connection.query(_query, insertData, (err, results, field) => {
                    if (err) {
                        console.error(err)
                    } else {
                        // console.log(results);
                    }
                });
            }
            connection.release();
        })
    },
    outBeacon(data) {
        const _query = queryConfig.update('info_beacon', 'bc_address');
        const { timestamp, input_time, mac, major, minor, battery, battery_timestamp } = data;
        const _updateData = {
            bc_input_time: null,
            bc_out_time: timestamp,
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
                        console.log(results);
                    }
                });
            }
            connection.release();
        })

    },
    alarmHandler(data) {
        const _this = this;
        const { mac } = data;
        const isMac = _this.emergency.hasOwnProperty(mac);
        if (isMac) {
            
        } else {
            // 처음 발생
            console.log(data)
            // _this.emergency={
            //     ..._this.emergency,
            //     [mac]: {
            //         start_time: 
            //     }
            // }
        }

    }

}


module.exports = bleserver;