const dbconfig = {
  host: "127.0.0.1",
  port: "13336",
  user: "hanwha_admin",
  password: "hanwha1801",
  database: "hanwha_hh_amons",
  multipleStatements: true, //다중 퀄리 사용가능
  connectionLimit: 100,
  acquireTimeout: 30000 //30 secs
};

module.exports = dbconfig;

