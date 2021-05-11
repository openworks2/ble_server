import pool from "./connectionPool";
import queryConfig from "./query/configQuery";

export const getFindALl = ({ table, req, res }) => {
  const _query = queryConfig.findByAll(table);
  return () =>
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(err);
        res
          .status(404)
          .json({ status: 404, message: "Pool getConnection Error" });
      } else {
        connection.query(_query, (err, results, field) => {
          if (err) {
            console.error(err);
            res
              .status(404)
              .json({ status: 404, message: "Connection Query Error" });
          } else {
            res.json(results);
          }
        });
      }
      connection.release();
    });
};

export const getFindByField = ({
  table,
  param,
  field,
  req,
  res,
}) => {
  const _query = queryConfig.findByField(table, field);
  return () =>
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(err);
        res
          .status(404)
          .json({ status: 404, message: "Pool getConnection Error" });
      } else {
        connection.query(
          _query,
          param,
          (err, results, field) => {
            if (err) {
              console.error(err);
              res
                .status(404)
                .json({ status: 404, message: "Connection Query Error" });
            } else {
              res.json(results);
            }
          }
        );
      }
      connection.release();
    });
};

export const postInsert = ({
  table,
  insertData,
  key,
  req,
  res,
}) => {
  const _query = queryConfig.insert(table);
  return () =>
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(err);
        res
          .status(404)
          .json({ status: 404, message: "Pool getConnection Error" });
      } else {
        connection.query(
          _query,
          insertData,
          (err, results, field) => {
            if (err) {
              console.error(err);
              res
                .status(404)
                .json({ status: 404, message: "Connection Query Error" });
            } else {
              const resObj = {
                ...insertData,
                [key]: results.insertId,
              };
              res.json(resObj);
            }
          }
        );
      }
      connection.release();
    });
};

export const putUpdate = ({
  table,
  field,
  updateData,
  req,
  res,
}) => {
  const _query = queryConfig.update(table, field);
  return () =>
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(err);
        res
          .status(404)
          .json({ status: 404, message: "Pool getConnection Error" });
      } else {
        connection.query(
          _query,
          updateData,
          (err, results, field) => {
            if (err) {
              console.error(err);
              res
                .status(404)
                .json({ status: 404, message: "Connection Query Error" });
            } else {
              const resObj = {
                ...updateData[0],
              };
              res.json(resObj);
            }
          }
        );
      }
      connection.release();
    });
};

export const deleteAction = ({
  table,
  field,
  param,
  req,
  res,
}) => {
  const _query = queryConfig.delete(table, field);
  return () =>
    pool.getConnection((err, connection) => {
      if (err) {
        res
          .status(404)
          .json({ status: 404, message: "Pool getConnection Error" });
      } else {
        connection.query(
          _query,
          param,
          (err, results, field) => {
            if (err) {
              console.error(err);
              res
                .status(404)
                .json({ status: 404, message: "Connection Query Error" });
            } else {
              const result = {
                ...results,
                param,
              };
              res.json(result);
            }
          }
        );
      }
      connection.release();
    });
};
