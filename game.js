let { ERR_RESP, makeResponse } = require('./util')
const dbHelper = require('./db-helper');
const { fgSaveFile, fgReadFile, readFile } = require('./fgfs');
const fs = require('fs');
const path = require('path');

const { CONFIG } = require('./config.js');

// key: invitee_id
// value: {
//   inviter_id: inviter's id,
//   room_id: room id,
//   created_at: time
// }
let invitingList = {}

const game = {
  async inviteToRoom(ctx, next) {
    if (!ctx.user) {
      makeResponse(ctx.response, 401, {
        "status": 1,
        "msg": "login first or request with token"
      });
      await next();
      return;
    }
    let body = ctx.request.fields;
    if (!('invitee_id' in body && 'room_id' in body)) {
      makeResponse(ctx.response, 415, {
        "status": 5,
        "msg": "parameters not enough"
      })
      await next();
      return;
    }
    let invitee_id = body.invitee_id;
    let room_id = body.room_id;

    if (!(invitee_id in invitingList)) {
      invitingList[invitee_id] = [];
    }

    invitingList[invitee_id].push({
      inviter_id: ctx.user.user_id,
      room_id: room_id,
      created_at: Date.now()
    })
    makeResponse(ctx.response, 200, {
      "status": 0,
      "msg": "Invitation sended!"
    });

    await next();
  },
  async pollInivitation(ctx, next) {
    if (!ctx.user) {
      makeResponse(ctx.response, 401, {
        "status": 1,
        "msg": "login first or request with token"
      });
    }
    let user_id = ctx.user.user_id;
    let data = invitingList[user_id] || [];
    // 删除1分钟以上的邀请
    for (let i = 0; i < data.length; ) {
      if (Date.now() - data[i].created_at > 60000) {
        data.splice(i, 1);
      } else {
        ++i;
      }
    }
    makeResponse(ctx.response, 200, {
      "status": 0,
      "msg": "Get invitations success!",
      "data": data
    })
    await next();
  },
  async postPhoto(ctx, next) {
    if (ctx.user == null) {
      makeResponse(ctx.response, 401, {
        'status': 1,
        'msg': 'Please login first, or give your token'
      })
      await next();
      return;
    }
    let body = ctx.request.body || ctx.request.fields;

    if (!('room_id' in body && 'stage' in body && 'photo' in body)) {
      makeResponse(ctx.response, 415, {
        "status": 5,
        "msg": "parameters not enough"
      })
      await next();
      return;
    }

    let fileDir = path.join(CONFIG.fs.dir_path, room_id);
    let filePath = path.join(fileDir, ctx.user.user_id + "-" + body.stage + ".png");

    if (!fs.existsSync())
      fs.mkdirSync(fileDir);

    fgSaveFile("" + ctx.user.user_id + body.stage, body.photo[0]);

    makeResponse(ctx.response, 200, {
      "status": 0,
      "msg": "Photo uploaded"
    })
    await next();
  },
  async getPhoto(ctx, next) {
    if (ctx.user == null) {
      makeResponse(ctx.response, 401, {
        'status': 1,
        'msg': 'Please login first, or give your token'
      })
      await next();
      return;
    }
    
    let body = ctx.request.body || ctx.request.fields || ctx.request.query;
    
    if (!('room_id' in body && 'stage' in body)) {
      makeResponse(ctx.response, 415, {
        "status": 5,
        "msg": "parameters not enough"
      })
      await next();
      return;
    }

    // TODO: Check if the user is the winner
    // TODO: Get the competitor's user id
    let comp_user_id = -1;
    
    let fileDir = path.join(CONFIG.fs.dir_path, body.room_id);
    let filePath = path.join(fileDir, comp_user_id + "-" + body.stage + ".png");
    if (!fs.lstatSync(filePath).isFile()) {
      makeResponse(ctx.response, 404, {
        "status": 1,
        "msg": "No such picture"
      });
      await next();
      return;
    }

    let file = await readFile(filePath);
    ctx.response.type = 'image/png';
    ctx.response.status = 200;
    ctx.response.body = file;

    await next();
  }
};

module.exports = {
  game
}