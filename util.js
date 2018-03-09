const crypto = require('crypto');

// inclusive
const randInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1));
}

const hashPassword = function(password, algo, salt) {
  let hash = crypto.createHmac(algo, salt);
  hash.update(password);
  let value = hash.digest('hex');
  return value;
}

const ERR_RESP = {
  4: {
    "status": 4,
    "msg": "server error"
  },
  5: {
    "status": 5,
    "msg": "parameters not enough"
  },
  6: {
    "status": 6,
    "msg": "please use json to request"
  }
}

const makeResponse = function (resp, status, body) {
  resp.type = 'json';
  resp.status = status;
  resp.body = body;
}

module.exports = {
  randInt,
  hashPassword,
  ERR_RESP,
  makeResponse
}