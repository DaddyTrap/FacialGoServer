let { ERR_RESP, makeResponse } = require('./util')
const dbHelper = require('./db-helper');

const { CONFIG } = require('./config.js');

// key: invitee_id
// value: {
//   inviter_id: inviter's id,
//   room_id: room id
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
      room_id: room_id
    })
    makeResponse(ctx.response, 200, {
      "status": 0,
      "msg": "Invitation sended!"
    });
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
    makeResponse(ctx.response, 200, {
      "status": 0,
      "msg": "Get invitations success!",
      "data": data
    })
  }
};

module.exports = {
  game
}