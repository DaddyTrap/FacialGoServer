let { ERR_RESP, makeResponse } = require('./util')
const dbHelper = require('./db-helper');
const { randInt, hashPassword } = require('./util');
const { fgSaveFile, fgReadFile } = require('./fgfs');

const { CONFIG } = require('./config.js');

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

const user_avatar = {
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
    let fields = ctx.request.fields;
    let file = fields.avatar[0];
    
    fgSaveFile(user_id + '.png', file);

    makeResponse(ctx.response, 200, {
      status: 0,
      msg: "Avatar updated"
    })

    await next();
  },
  get: async (ctx, user_id, next) => {
    let file = null;
    try {
      file = await fgReadFile(user_id + '.png');
    } catch (error) {
      // use default
      file = await fgReadFile('default.png');
    }
    ctx.response.type = 'image/png';
    ctx.response.status = 200;
    ctx.response.body = file;
    await next();
  },
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

const user_friend = {
  get: async (ctx, user_id, next) => {
    if (!ctx.user || !(ctx.user.user_id == user_id)) {
      makeResponse(ctx.response, 401, {
        "status": 1,
        "msg": "You can only know your friends"
      });
      await next();
      return;
    }
    let sql = 'SELECT user.user_id, user.nickname, user.avatar, user.exp ' + 
              'FROM user JOIN friend ON user.user_id = friend.user_friend_id ' +
              'WHERE friend.user_id = ?';
    let sqlparams = [user_id];

    let datList = await dbHelper.query(sql, sqlparams);
    makeResponse(ctx.response, 200, {
      'status': 0,
      'msg': "Get friend list success!",
      'data': datList
    });

    await next();
  },
  post: async (ctx, user_id, next) => {
    if (!ctx.user || !(ctx.user.user_id == user_id)) {
      makeResponse(ctx.response, 401, {
        "status": 2,
        "msg": "You can only change your own friends"
      });
      await next();
      return;
    }
    let body = ctx.request.fields;
    let sql = 'SELECT user_id FROM user WHERE user_id = ?';
    let sqlparams = [body.user_id];
    let dataList = await dbHelper.query(sql, sqlparams);
    if (dataList.length <= 0) {
      makeResponse(ctx.response, 404, {
        "status": 2,
        "msg": "You can only change your own friends"
      })
      await next();
      return;
    }
    sql = 'SELECT user_friend_id FROM friend WHERE user_id = ? AND user_friend_id = ?';
    sqlparams = [user_id, body.user_id];
    dataList = await dbHelper.query(sql, sqlparams);
    if (dataList.length > 0) {
      makeResponse(ctx.response, 404, {
        "status": 3,
        "msg": "Duplicate friendship"
      })
      await next();
      return;
    }

    sql = 'INSERT INTO friend (user_id, user_friend_id) VALUES (?, ?)';
    sqlparams = [user_id, body.user_id];
    await dbHelper.query(sql, sqlparams);
    makeResponse(ctx.response, 200, {
      "status": 0,
      "msg": "Add friend success!"
    })
    await next();
  },
  delete: async (ctx, user_id, friend_id, next) => {
    if (!ctx.user || !(ctx.user.user_id == user_id)) {
      makeResponse(ctx.response, 401, {
        "status": 2,
        "msg": "You can only delete your own friends"
      });
      await next();
      return;
    }
    let sql = 'SELECT user_id FROM friend WHERE user_id = ? AND user_friend_id = ?';
    let sqlparams = [user_id, friend_id];
    let dataList = await dbHelper.query(sql, sqlparams);
    if (dataList.length <= 0) {
      makeResponse(ctx.response, 404, {
        "status": 1,
        "msg": "Your friend doesn't exist"
      })
      await next();
      return;
    }
    sql = 'DELETE FROM friend WHERE user_id = ? AND user_friend_id = ?';
    sqlparams = [user_id, friend_id];
    await dbHelper.query(sql, sqlparams);
    makeResponse(ctx.response, 200, {
      "status": 0,
      "msg": "Delete friend success!"
    })
    await next();
  }
}

module.exports = {
  user,
  user_avatar,
  user_login,
  user_friend
}