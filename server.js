const crypto = require("crypto");
const Koa = require('koa');
const fs = require('fs');
const route = require('koa-route');
const koaBody = require('koa-bodyparser');
const dbHelper = require('./db-helper');

const app = new Koa();

let config_raw = fs.readFileSync("config.json");
let config = JSON.parse(config_raw);

app.listen(config['network']['http-listen-port']);
app.use(koaBody());

// logger

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}`);
});

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

function makeResponse(resp, status, body) {
  resp.type = 'json';
  resp.status = status;
  resp.body = body;
}

// inclusive
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1));
}

function hashPassword(password, algo, salt) {
  let hash = crypto.createHmac(algo, salt);
  hash.update(password);
  let value = hash.digest('hex');
  return value;
}

const user = {
  post: async (ctx, next) => {
    if (!ctx.is("application/json")) {
      makeResponse(ctx.response, 415, ERR_RESP[6]);
      console.log("Not json request");
    } else {
      let body = ctx.request.body;
      if ("phone_number" in body) {
        // check duplicate
        let sql = 'SELECT * FROM user WHERE `phone_number` = ?';
        let sqlparams = [body.phone_number];
        let dataList = await dbHelper.query(sql, sqlparams);
        
        if (dataList.length != 0) {
          // have duplicate
          makeResponse(ctx.response, 200, {
            "status": 1,
            "msg": "Duplicate phone_number"
          });
          next();
          return;
        }
        
        // generate random password
        let password = '' + randInt(0, 9) + randInt(0, 9) + randInt(0, 9) + randInt(0, 9);

        sql = "INSERT INTO user (phone_number, password, nickname) VALUES (?, ?, ?)";
        sqlparams = [body.phone_number, hashPassword(password, config.auth.algorithm, config.auth.salt), body.phone_number];
        await dbHelper.query(sql, sqlparams);

        makeResponse(ctx.response, 200, {
          "status": 0,
          "msg": "Register success!",
          "data": password
        });
      } else {
        makeResponse(ctx.response, 415, ERR_RESP[5]);
      }
    }
    next();
  }
}

app.use(route.post('/user', user.post))