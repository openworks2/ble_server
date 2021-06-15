const express = require('express');
// const cors = require('cors');
const createError = require('http-errors');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const app = express();
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 8084;


const indexRoute = require('./routes/index');
const bleRoute = require('./routes/bleRouter');

// app.use(cors());

app.use(bodyParser.json());
app.use('/api', indexRoute); // app.use('/api', (req, res)=> res.json({username:'bryan'}));
app.use('/api/ble', bleRoute);

app.listen(port, () => {
    console.log(`express is running on ${port}`);
})
