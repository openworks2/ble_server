const queryConfig = {
 
  findByAll(table) {
    const query = `SELECT * FROM ${table};`;
    return query;
  },
  findByField(table, field = "id") {
    const query = `SELECT * FROM ${table} WHERE \`${field}\`=?;`;
    return query;
  },
  findByFieldAtOrder(
    table,
    field = "id",
    orderField = "id",
    type = "DESC"
  ) {
    const query = `SELECT * FROM ${table} WHERE \`${field}\=? ORDER BY \`${orderField}\` ${type};`;
    return query;
  },
  insert(table) {
    const query = `INSERT INTO ${table} SET ?;`;
    return query;
  },
  update(table, field = "id") {
    const query = `UPDATE ${table} SET ? WHERE \`${field}\`=?;`;
    return query;
  },
  delete(table, field = "id") {
    const query = `DELETE FROM ${table} WHERE \`${field}\`=?;`;
    return query;
  },
  doubleCheck() {
    let query = `SELECT COUNT(*) AS count FROM tb_account  WHERE acc_user_id=?;`;
    return query;
  },
};

module.exports= queryConfig;
