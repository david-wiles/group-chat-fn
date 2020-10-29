'use strict'

const {mongo} = require("./mongo");
const Users = require("./users");

/**
 * Parses a date string to return a valid date or null
 * @param dateString
 */
const dateOrNull = (dateString) => {
  if (!dateString) return null;

  let d = new Date(dateString);
  return d.toString() === 'Invalid Date' ? null : d;
};

/**
 * Inserts a message into the given group's collection
 * @param group
 * @param message
 * @param timestamp
 * @param user
 * @returns {Promise<Function>}
 */
const addMessage = (group, message, timestamp, user) => {
  return new Promise((resolve, reject) => {
    mongo()
      .then((db) => {
        db.collection(group)
          .insert({
            "message": message,
            "login": user.login,
            "timestamp": timestamp
          }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
      })
      .catch(err => reject(err));
  });
}

/**
 * Gets all messages between a certain range for the given group
 * @param group
 * @param low
 * @param high
 */
const getMessages = (group, low, high) => {
  return new Promise((resolve, reject) => {
    low = dateOrNull(low);
    high = dateOrNull(high);
    let now = new Date();

    if (!low) {
      // Default low date: one day in the past
      low = new Date(now - 86400000);
    }

    if (!high) {
      // Default high date is now
      high = now;
    }

    mongo()
      .then((db) => {
        db.collection(group)
          .find({
            timestamp: {
              $gte: low,
              $lte: high
            }
          })
          .toArray((err, docs) => {
            if (err) reject(err)
            else resolve(docs);
          });
      })
      .catch(err => reject(err));
  });
};

/**
 * Finalizes the response with the given response
 * @param context
 * @param response
 */
const finalize = (context, response) => {
  return context
    .status(response.status)
    .succeed(response.result);
};

// Checks that a user is a member of the group they try to access
const groupGuard = (event, response, user) => {
  if (!user.groups.includes(event.path.slice(1))) {
    response.result.insufficientPermissions = true;
    response.result.message = "Invalid group id";
    response.status = 401;
    return false;
  }
  return true;
};

module.exports = async (event, context) => {

  // Initialize response
  let response = {
    result: {
      error: false,
      insufficientPermissions: false,
      message: "",
      jwt: "",
      chats: []
    },
    status: 200
  };
  let user = undefined;

  // Authenticate the user making the request
  try {
    let payload = await Users.authenticate(event);
    if (payload.jwt) {
      response.result.jwt = payload.jwt;
    }
    user = payload.user;
  } catch (err) {
    response.result.error = true;
    response.result.message = err.toString();
    response.status = 401;
    return finalize(context, response);
  }

  let timestamp = new Date();

  // Get or post messages
  try {
    switch (event.method) {
      case "PUT":
        if (event.path === "/create") {
          await Users.createGroup(event, user);
          response.status = 200;
        } else {
          if (!groupGuard(event, response, user)) return finalize(context, response);
          await Users.addToGroup(event, event.path.slice(1), user);
        }
        break;
      case "POST":
        if (!groupGuard(event, response, user)) return finalize(context, response);
        await addMessage(event.path.slice(1), event.body.message, timestamp, user);
        break;
      case "GET":
      default:
        if (!groupGuard(event, response, user)) return finalize(context, response);
        response.result.chats = await getMessages(event.path.slice(1), event.query.low, event.query.high);
    }
  } catch (err) {
    response.result.error = true;
    response.result.message = err.toString();
    response.status = 500;
    return finalize(context, response);
  }

  return finalize(context, response);
};
