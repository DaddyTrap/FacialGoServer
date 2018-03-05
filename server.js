const crypto = require("crypto");
const Koa = require('koa');
const fs = require('fs');
const route = require('koa-route');
const koaBody = require('koa-bodyparser');
const dbHelper = require('./db-helper');

const {randInt, hashPassword} = require('./util');

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
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
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

const makeResponse = function (resp, status, body) {
  resp.type = 'json';
  resp.status = status;
  resp.body = body;
}

const user = {
  post: async (ctx, next) => {
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
    }
    next();
  },
  get: async (ctx, user_id, next) => {
    let sql = "SELECT user_id, nickname, avatar, exp, diamond FROM user WHERE user_id = ?";
    let sqlparams = [user_id];
    let dataList = await dbHelper.query(sql, sqlparams);

    if (dataList.length == 0) {
      makeResponse(ctx.response, 404, {
        'status': 1,
        "msg": "No such user"
      });
      next();
    } else {
      let user = dataList[0];
      makeResponse(ctx.response, 200, {
        "status": 0,
        "msg": "Get user info success!",
        "data": {
          "user": user
        }
      });
    }
  }
}

const user_login = {
  post: async (ctx, next) => {
    console.log(ctx.request.body);
    let body = ctx.request.body;
    let sql = 'SELECT user_id, nickname, avatar, exp, diamond FROM user WHERE phone_number = ? AND password = ?';
    let sqlparams = [body.phone_number, hashPassword(body.password, config.auth.algorithm, config.auth.salt)];
    let dataList = await dbHelper.query(sql, sqlparams);
    if (dataList.length == 0) {
      makeResponse(ctx.response, 404, {
        'status': 1,
        'msg': 'phone/password wrong'
      });
      next();
    } else {
      // user exists
      let user = dataList[0];

      sql = 'SELECT token FROM token WHERE user_id = ?';
      sqlparams = [user.user_id];
      dataList = await dbHelper.query(sql, sqlparams);
      let token = null;
      if (dataList.length == 0) {
        // no token yet, generate one
        console.log("Generate token");
        let token_plain = '' + user.user_id + Date.now();
        token = hashPassword(token_plain, config.auth.algorithm, config.auth.salt);
        // insert into token table
        sql = 'INSERT INTO token (user_id, token) values (?, ?)';
        sqlparams = [user.user_id, token];
        await dbHelper.query(sql, sqlparams);
      } else {
        console.log("Token exists, get it");
        token = dataList[0].token;
      }
      
      makeResponse(ctx.response, 200, {
        "status": 0,
        'msg': 'Login success!',
        "data": {
          'user': user,
          'token': token
        }
      });
      next();
    }
  }
}

app.use(route.post('/user', user.post));
app.use(route.get('/user/:user_id', user.get));
app.use(route.post('/user/login', user_login.post));