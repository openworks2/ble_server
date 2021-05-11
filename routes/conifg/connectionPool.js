const mysql = require("mysql");
const dbconfig = require("./database");
const pool = mysql.createPool(dbconfig);

module.exports = pool;

