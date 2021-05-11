const express = require('express');
const router = express.Router();

const moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");


var converter = require('hex2dec');
const pool = require('./conifg/connectionPool');
const queryConfig = require('./conifg/query/configQuery')

// const ble = require('./conifg/ble');
const ble = require('./conifg/ble_dev');
ble.init();
setInterval(()=>{
    ble.init();
}, 30000);


router.post('/:scanner', (req, res, next) => {
    const reqBody = req.body;
    const { scanner } = req.params;
    ble.receive(reqBody, scanner)

    res.status(200).end();
});




module.exports = router;