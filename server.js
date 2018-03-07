const crypto = require("crypto");
const Koa = require('koa');
const route = require('koa-route');
const mount = require('koa-mount');
const koaBody = require('koa-better-body');

const dbHelper = require('./db-helper');
const {randInt, hashPassword} = require('./util');
const {fgSaveFile, fgReadFile} = require('./fgfs');

const app = new Koa();

const { CONFIG } = require('./config.js');

app.listen(CONFIG['network']['http-listen-port']);

// body parser
app.use(koaBody());

// logger
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

// auth
app.use(mount("/user", async (ctx, next) => {
  let body = ctx.request.body || ctx.request.fields;
  let fields = ctx.request.fields;
  console.log(fields);
  if (!((body && 'token' in body) || (fields && 'token' in fields))) {
    ctx.user = null;
    await next();
    return;
  }
  let token_holder = body || fields;
  let token = token_holder.token;
  let sql = 'SELECT user_id FROM token WHERE token = ?';
  let sqlparams = [token];
  let user_ids = await dbHelper.query(sql, sqlparams);
  if (user_ids.length == 0) {
    ctx.user = null;
  } else {
    ctx.user = {
      user_id: user_ids[0].user_id
    };
  }
  await next();
}));

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
  register: async (ctx, next) => {
    let body = ctx.request.body || ctx.request.fields;
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
        await next();
        return;
      }
      
      // generate random password
      let password = '' + randInt(0, 9) + randInt(0, 9) + randInt(0, 9) + randInt(0, 9);

      sql = "INSERT INTO user (phone_number, password, nickname) VALUES (?, ?, ?)";
      sqlparams = [body.phone_number, hashPassword(password, CONFIG.auth.algorithm, CONFIG.auth.salt), body.phone_number];
      await dbHelper.query(sql, sqlparams);

      makeResponse(ctx.response, 200, {
        "status": 0,
        "msg": "Register success!",
        "data": password
      });
    }
    await next();
  },
  post: async (ctx, user_id, next) => {
    if (ctx.user == null) {
      makeResponse(ctx.response, 401, {
        'status': 1,
        'msg': 'Please login first, or give your token'
      })
      await next();
      return;
    }
    if (ctx.user.user_id != user_id) {
      console.log(ctx.user.user_id);
      console.log(user_id);
      makeResponse(ctx.response, 401, {
        'status': 2,
        'msg': "Cannot change others' info"
      });
      await next();
      return;
    }
    console.log(ctx.request.rawBody);
    let body = ctx.request.body || ctx.request.fields;
    console.log(body);
    if (!('password' in body || 'nickname' in body)) {
      makeResponse(ctx.response, 415, {
        'status': 5,
        'msg': "parameters not enough"
      });
      await next();
      return;
    }
    let user = {};
    if ('password' in body) {
      user.password = hashPassword(body.password, CONFIG.auth.algorithm, CONFIG.auth.salt);
    }
    if ('nickname' in body) {
      user.nickname = body.nickname;
    }
    let keys = Object.keys(user);
    for (let i = 0; i < keys.length; ++i) keys[i] += '=?';
    let values = Object.values(user);
    values.push(user_id);
    let sql = `UPDATE user SET ${keys.join(',')} WHERE user_id = ?`;
    let sqlparams = values;
    await dbHelper.query(sql, sqlparams);

    makeResponse(ctx.response, 200, {
      'status': 0,
      'msg': `Update success!`
    });
    await next();
  },
  post_avatar: async (ctx, user_id, next) => {
    if (ctx.user == null) {
      makeResponse(ctx.response, 401, {
        'status': 1,
        'msg': 'Please login first, or give your token'
      })
      await next();
      return;
    }
    if (ctx.user.user_id != user_id) {
      console.log(ctx.user.user_id);
      console.log(user_id);
      makeResponse(ctx.response, 401, {
        'status': 2,
        'msg': "Cannot change others' info"
      });
      await next();
      return;
    }
    let fields = ctx.request.fields;
    let file = fields.avatar[0];
    
    fgSaveFile(user_id + '.png', file);

    makeResponse(ctx.response, 200, {
      status: 0,
      msg: "Avatar updated"
    })

    await next();
  },
  get_avatar: async (ctx, user_id, next) => {
    let file = await fgReadFile(user_id + '.png');
    ctx.response.type = 'image/png';
    ctx.response.status = 200;
    ctx.response.body = file;
    await next();
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
      await next();
    } else {
      let user = dataList[0];
      makeResponse(ctx.response, 200, {
        "status": 0,
        "msg": "Get user info success!",
        "data": {
          "user": user
        }
      });
      await next();
    }
  }
}

const user_login = {
  post: async (ctx, next) => {
    let body = ctx.request.body || ctx.request.fields;
    let sql = 'SELECT user_id, nickname, avatar, exp, diamond FROM user WHERE phone_number = ? AND password = ?';
    let sqlparams = [body.phone_number, hashPassword(body.password, CONFIG.auth.algorithm, CONFIG.auth.salt)];
    let dataList = await dbHelper.query(sql, sqlparams);
    if (dataList.length == 0) {
      makeResponse(ctx.response, 404, {
        'status': 1,
        'msg': 'phone/password wrong'
      });
      await next();
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
        token = hashPassword(token_plain, CONFIG.auth.algorithm, CONFIG.auth.salt);
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
      await next();
    }
  }
}

const photon_auth = {
  get: async (ctx, next) => {
    let body = ctx.request.body || ctx.request.fields;
    if ('user_id' in body && 'token' in body && 'api_key' in body) {
      // Check if trusted
      if (body.api_key != CONFIG.photon_auth.api_key) {
        makeResponse(ctx.response, 200, {
          "ResultCode": 2
        });
        await next();
        return;
      }
      
      let sql = 'SELECT user_id, token FROM token WHERE user_id = ? AND token = ?';
      let sqlparams = [body.user_id, body.token];
      let dataList = await dbHelper.query(sql, sqlparams);
      if (dataList.length == 0) {
        makeResponse(ctx.response, 200, {
          "ResultCode": 2
        });
        await next();
        return;        
      }

      makeResponse(ctx.response, 200, {
        'ResultCode': 1
      });
    } else {
      makeResponse(ctx.response, 200, {
        'ResultCode': 3
      });
      await next();
    }
  }
}

app.use(route.post('/user', user.register));
app.use(route.get('/user/:user_id', user.get));
app.use(route.post('/user/:user_id', user.post));
app.use(route.post('/user/:user_id/avatar', user.post_avatar));
app.use(route.get('/user/:user_id/avatar', user.get_avatar));
app.use(route.post('/user/login', user_login.post));
app.use(route.get('/photon_auth', photon_auth.get));