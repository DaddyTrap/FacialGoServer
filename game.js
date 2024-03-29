let { ERR_RESP, makeResponse } = require('./util')
const dbHelper = require('./db-helper');
const { fgSaveFile, fgReadFile, readFile } = require('./fgfs');
const fs = require('fs');
const path = require('path');

const sharp = require('sharp');
const request = require('request');

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
    // FIXME: 此处的删除并不是线程安全的
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

    let fileDir = path.join(CONFIG.fs.dir_path, body.room_id);
    let filePath = path.join(fileDir, ctx.user.user_id + "-" + body.stage + ".png");

    if (!fs.existsSync(fileDir))
      fs.mkdirSync(fileDir);

    const stream = fs.createWriteStream(filePath);
    const reader = fs.createReadStream(body.photo[0].path);
    reader.pipe(stream);

    reader.once('finish', ()=>{
      this.processPhoto(filePath);
    });

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

    // Check if the user is the winner
    let sql = 'SELECT * FROM `match` WHERE room_id = ?';
    let sqlparams = [body.room_id];
    let dataList = await dbHelper.query(sql, sqlparams);
    if (dataList.length <= 0) {
      makeResponse(ctx.response, 415, {
        "status": 2,
        "msg": "You are not the winner of this match!"
      });
      await next();
      return;
    }

    // Get the competitor's user id
    let match_res = dataList[0];
    let comp_user_id = (match_res.won_id == match_res.part1_id) ? match_res.part2_id : match_res.part1_id;
    if (match_res.part2_id == null) comp_user_id = match_res.part1_id;
    //console.log(`this user: ${user.user_id}, comp_user_id: ${comp_user_id}`);
    console.log(`part1_id: ${match_res.part1_id}, part2_id: ${match_res.part2_id}, won_id: ${match_res.won_id}`);
    
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
  },
  async deleteInvitation(ctx, user_id, next) {
    let user = ctx.user;

    if (user.user_id != user_id) {
      makeResponse(ctx.response, 415, {
        "status": 1,
        "msg": "You can only delete your invitations"
      });
      await next();
      return;
    }
    invitingList[user_id] = [];
    makeResponse(ctx.response, 200, {
      "status": 0,
      "msg": "Deleted invitations"
    });

    await next();
  },
  async processPhoto(file_path) {
    let formData = {
      api_key: CONFIG.api.api_key,
      api_secret: CONFIG.api.api_secret,
      image_file: fs.createWriteStream(file_path)
    };
    return new Promise((resolve, reject)=>{
      request.post({
        url: 'https://api-cn.faceplusplus.com/facepp/v3/detect',
        formData
      }, (error, response, body)=>{
        if(error){
          console.log(error)
        }

        if (body === undefined){

        } else {
          res = JSON.parse(body);
          var one_face = res.faces[0].face_rectangle;
          console.log(one_face);
          console.log(one_face.width);
          sharp(file_path)
            .extract({ left: one_face.left, top: one_face.top, width: one_face.width, height: one_face.height })
            .rotate(-90)
            .toFile(file_path, function(err) {
              console.log(err);
            });
        }
        resolve();
      });
    });
  }
};

module.exports = {
  game
}
