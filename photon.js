let { ERR_RESP, makeResponse } = require('./util')
const dbHelper = require('./db-helper');
const { CONFIG } = require('./config.js');

const photon_auth = {
  get: async (ctx, next) => {
    let body = ctx.request.body || ctx.request.fields || ctx.query;
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

const returnObject = {
  success: {
    'ResultCode': 0
  },
  proto_err: {
    'ResultCode': 1
  },
  app_err: {
    'ResultCode': 2
  }
}

const photon_webhook = {
  async modifyUserAfterMatch(user_id, won_id) {
    let sql = 'SELECT `exp`, `diamond` FROM `user` WHERE user_id = ?';
    let sqlparams = [user_id];
    let dataList = await dbHelper.query(sql, sqlparams);
    let user = dataList[0];

    if (user_id == won_id) {
      user.exp += 40;
      user.diamond += 2;
    } else {
      user.exp += 20;
    }
    sql = 'UPDATE `user` SET exp = ?, diamond = ? WHERE user_id = ?';
    sqlparams = [user.exp, user.diamond, user_id];
    await dbHelper.query(sql, sqlparams);
  },
  async PathEvent(ctx, next) {
    let body = ctx.request.body || ctx.request.fields;
    // console.log(body);

    let EvCode = body.EvCode;

    if (EvCode == 1) { // Match Result
      let [part_id, is_won] = body.Data;
      let room_id = body.GameId;
      console.log(`Room ${room_id}: ${part_id} ${is_won ? 'won' : 'lost'}`);
      body.Data.push(room_id);
      let sql = '';
      let sqlparams = [];
      let won_id = -1;
      if (is_won == 0) {
        // lose
        sql = 'INSERT INTO `match` (part1_id, room_id) VALUES (?,?) ON DUPLICATE KEY UPDATE `part2_id`=?'
        sqlparams = [part_id, room_id, part_id]
      } else {
        // win
        sql = 'INSERT INTO `match` (part1_id, won_id, room_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `part2_id`=?, `won_id`=?';
        sqlparams = [part_id, part_id, room_id, part_id, part_id];
        won_id = part_id;
      }
      await dbHelper.query(sql, sqlparams);

      await photon_webhook.modifyUserAfterMatch(part_id, won_id);
      makeResponse(ctx.response, 200, returnObject.success);
      await next();
    }
  },
  async PathClose(ctx, next) {
    let body = ctx.request.body || ctx.request.fields;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
    await next();
  },
  async PathCreate(ctx, next) {
    let body = ctx.request.body || ctx.request.fields;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
    await next();
  },
  async PathGameProperties(ctx, next) {
    let body = ctx.request.body || ctx.request.fields;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
    await next();
  },
  async PathJoin(ctx, next) {
    let body = ctx.request.body || ctx.request.fields;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
    await next();
  },
  async PathLeave(ctx, next) {
    let body = ctx.request.body || ctx.request.fields;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
    await next();
  },
}

module.exports = {
  photon_auth,
  photon_webhook
}