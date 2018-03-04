# Facial Go 服务端

## API

`status` 字段表示成功/失败，若为 **0** 则表示成功，其他则是错误代码

### 共用失败返回

```json
{
  "status": 4,
  "msg": "server error"
}
```

```json
{
  "status": 5,
  "msg": "parameters not enough"
}
```

```json
{
  "status": 6,
  "msg": "please use json to request"
}
```

### 用户 (`/user`)

#### POST - `/user` - 注册

请求:

```json
{
  "phone_number": 12312341234
}
```

成功返回:

```json
{
  "status": 0,
  "msg": "Register success!",
  "data": "temp password"
}
```

失败返回:

```json
{
  "status": 1,
  "msg": "Duplicate phone_number"
}
```

#### POST - `/user/login` - 登录

请求:

```json
{
  "phone_number": 12312341234,
  "password": "the pass"
}
```

成功返回:
```json
{
  "status": 0,
  "msg": "Login success!",
  "data": {
    "user": {
      "user_id": 1,
      "nickname": "the nickname",
      "avatar": "url to get avatar",
      "exp": 120,
      "diamond": 542
    },
    "token": "random token, use to auth"
  }
}
```

失败返回:

```json
{
  "status": 1,
  "msg": "phone/password wrong"
}
```

#### GET - `/user/:user_id` - 获取用户信息

请求: 空

成功返回:
```json
{
  "status": 0,
  "msg": "Get user info success!",
  "data": {
    "user": {
      "user_id": 1,
      "nickname": "the nickname",
      "avatar": "url to get avatar",
      "exp": 120,
      "diamond": 542
    }
  }
}
```

失败返回:
```json
{
  "status": 1,
  "msg": "No such user"
}
```
