const crypto = require("crypto");
const Koa = require('koa');
const route = require('koa-route');
const mount = require('koa-mount');
const koaBody = require('koa-better-body');

const dbHelper = require('./db-helper');
const { randInt, hashPassword } = require('./util');
const { user, user_login } = require('./user');
const { fgSaveFile, fgReadFile } = require('./fgfs');
const { photon_auth } = require('./photon')

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

app.use(route.post('/user', user.register));
app.use(route.get('/user/:user_id', user.get));
app.use(route.post('/user/:user_id', user.post));
app.use(route.post('/user/:user_id/avatar', user.post_avatar));
app.use(route.get('/user/:user_id/avatar', user.get_avatar));
app.use(route.post('/user/login', user_login.post));
app.use(route.get('/photon_auth', photon_auth.get));