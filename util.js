let crypto = require('crypto');

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

module.exports = {
  randInt,
  hashPassword
}