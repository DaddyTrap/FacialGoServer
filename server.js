const crypto = require("crypto");
const Koa = require('koa');
const route = require('koa-route');
const mount = require('koa-mount');
const koaBody = require('koa-better-body');

const dbHelper = require('./db-helper');
const { randInt, hashPassword } = require('./util');
const { user, user_login, user_avatar, user_friend } = require('./user');
const { fgSaveFile, fgReadFile } = require('./fgfs');
const { photon_auth, photon_webhook } = require('./photon')
const { game } = require('./game')

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

let auth = async (ctx, next) => {
  let body = ctx.request.body || ctx.request.fields;
  if (!(body && 'token' in body) && !('token' in ctx.query)) {
    ctx.user = null;
    await next();
    return;
  }
  let token_holder = body || ctx.query;
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
}

// auth
app.use(mount("/user", auth));
app.use(mount("/game", auth));

app.use(route.post('/user', user.register));
app.use(route.get('/user/:user_id', user.get));
app.use(route.post('/user/:user_id', user.post));
app.use(route.post('/user/:user_id/avatar', user_avatar.post));
app.use(route.get('/user/:user_id/avatar', user_avatar.get));
app.use(route.post('/user/login', user_login.post));
app.use(route.get('/user/:user_id/friend', user_friend.get));
app.use(route.post('/user/:user_id/friend', user_friend.post));
app.use(route.post('/user/:user_id/friend/:friend_id', user_friend.delete));
app.use(route.get('/photon_auth', photon_auth.get));

let webhook_baseurl = `/photon_webhook/${CONFIG.photon_appid}`;

app.use(route.post(webhook_baseurl + '/PathEvent', photon_webhook.PathEvent));
app.use(route.post(webhook_baseurl + '/PathClose', photon_webhook.PathClose));
app.use(route.post(webhook_baseurl + '/PathCreate', photon_webhook.PathCreate));
app.use(route.post(webhook_baseurl + '/PathGameProperties', photon_webhook.PathGameProperties));
app.use(route.post(webhook_baseurl + '/PathJoin', photon_webhook.PathJoin));
app.use(route.post(webhook_baseurl + '/PathLeave', photon_webhook.PathLeave));

app.use(route.post('/game/inviteToRoom', game.inviteToRoom));
app.use(route.get('/game/pollInvitation', game.pollInivitation));
app.use(route.post('/game/postPhoto', game.postPhoto));
app.use(route.get('/game/getPhoto', game.getPhoto));