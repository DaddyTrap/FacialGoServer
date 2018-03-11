let { ERR_RESP, makeResponse } = require('./util')
const dbHelper = require('./db-helper');
const { CONFIG } = require('./config.js');

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
  PathEvent(ctx, next) {
    let body = ctx.request.body;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
  },
  PathClose(ctx, next) {
    let body = ctx.request.body;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
  },
  PathCreate(ctx, next) {
    let body = ctx.request.body;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
  },
  PathGameProperties(ctx, next) {
    let body = ctx.request.body;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
  },
  PathJoin(ctx, next) {
    let body = ctx.request.body;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
  },
  PathLeave(ctx, next) {
    let body = ctx.request.body;
    console.log(body);
    makeResponse(ctx.response, 200, returnObject.success);
  },
}

module.exports = {
  photon_auth,
  photon_webhook
}