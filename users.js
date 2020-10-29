const http = require("http");
const jwt = require("jsonwebtoken");
const {mongo} = require("./mongo");

/**
 * Authenticates a user and returns an object containing their information
 * @param event
 */
exports.authenticate = (event) => {
  return new Promise((resolve, reject) => {
    if (!event.headers.authorization) reject(new Error("No login information found"));
    else {
      let [type, token] = (event.headers.authorization || "").split(" ");
      if (type.toLowerCase() === "basic") {
        let req = http.request({
          method: "GET",
          hostname: process.env.AUTH_SERVICE_HOST,
          // TEST
          port: 8000,
          headers: {
            "Authorization": event.headers.authorization
          }
        }, (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => resolve(JSON.parse(body)));
        });

        req.on("error", (err) => reject(err));
        req.end();
      } else {
        // Verify jwt
        jwt.verify(token, process.env.JWT_SECRET, {algorithms: ["HS512"]}, (err, payload) => {
          if (err) reject(err);
          else resolve(payload);
        });
      }
    }
  });
};

const updateUser = (user) => {
  return new Promise((resolve, reject) => {
    let req = http.request({
      method: "POST",
      hostname: process.env.AUTH_SERVICE_HOST,
      headers: {
        "Authorization": event.headers.authorization
      }
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve(JSON.parse(bdoy)));
    });

    req.write(user);
    req.on("error", (err) => reject(err));
    req.end();
  });
};

/**
 * Adds a group to a user
 * @param event
 * @param groupId
 * @param user
 * @returns {Promise<>}
 */
const addToGroup = (event, groupId, user) => {
  if (!user.groups.includes(groupId)) {
    user.groups.push(groupId);
  }

  return updateUser(user);
};
exports.addToGroup = addToGroup;

/**
 * Creates a new group if it doesn't exist
 * @param event
 * @param user
 * @returns {Promise}
 */
exports.createGroup = (event, user) => {
  return new Promise((resolve, reject) => {
    mongo()
      .then((db) => {
        db.collections((err, cols) => {
          if (err) reject(err);
          else {
            // Check if the group id already exists as a collection.
            // If not, then create the collection and add to the user's list of groups
            if (!cols.includes(event.body.groupId.slice(1))) {
              db.createCollection(event.body.groupId, (err) => {
                if (err) reject(err);
                else {
                  addToGroup(event, event.body.groupId, user)
                    .then(() => resolve())
                    .catch((err) => reject(err));
                }
              });
            } else {
              reject(new Error("Collection already exists"));
            }
          }
        });
      })
      .catch((err) => reject(err));
  });
};
