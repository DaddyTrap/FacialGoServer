let { ERR_RESP, makeResponse } = require('./util')

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

module.exports = {
  user,
  user_login
}