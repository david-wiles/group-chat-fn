const MongoClient = require("mongodb").MongoClient;

let db = null;

/**
 * Gets the current database connection or opens a new one
 * @returns {Promise<db>}
 */
exports.mongo = () => {
  return new Promise((resolve, reject) => {
    if (!db) {
      MongoClient.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true}, (err, client) => {
        if (err) reject(err);
        else {
          db = client.db(process.env.MONGO_DB);
          resolve(db);
        }
      });
    } else {
      resolve(db);
    }
  });
};
