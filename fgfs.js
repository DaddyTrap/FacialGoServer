const fs = require("fs");
const path = require('path');
const { CONFIG } = require('./config.js');

const readFile = function (fileName) {
  return new Promise(function (resolve, reject) {
    fs.readFile(fileName, function(error, data) {
      if (error) return reject(error);
      resolve(data);
    });
  });
};

const fgSaveFile = async (filename, file) => {
  const reader = fs.createReadStream(file.path);
  if (!fs.existsSync(CONFIG.fs.dir_path))
    fs.mkdirSync(CONFIG.fs.dir_path);
  const stream = fs.createWriteStream(path.join(CONFIG.fs.dir_path, filename));
  reader.pipe(stream);
};

const fgReadFile = async (filename) => {
  return await readFile(path.join(CONFIG.fs.dir_path, filename));
}

module.exports = {fgSaveFile, fgReadFile, readFile};