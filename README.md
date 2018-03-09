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

#### POST - `/user/:user_id` - 更新用户信息(密码、昵称)

请求:

```json
{
  "nickname": "new nickname",
  "password": "new password in plain text",
  "token": "the token got when login"
}
```
> 两个字段可以只更新一个，也可以更新两个

成功返回:

```json
{
  "status": 0,
  "msg": "Update success!"
}
```

失败返回:

```json
{
  "status": 1,
  "msg": "Please login first, or give your token"
}
```

```json
{
  "status": 2,
  "msg": "Cannot change others' info"
}
```

#### POST - `/user/:user_id/avatar` - 更新用户头像

请求:

```json
{
  "avatar": [ bytes ],
  "token": "the token got when login"
}
```

> 附Unity代码例子

```c#
IEnumerator Upload() {
  WWWForm form = new WWWForm();
  byte[] arr = new byte[2];
  arr[0] = 0x11;
  arr[1] = 0x22;

  form.AddBinaryData("avatar", arr);
  form.AddField("token", "1");

  WWW www = new WWW("http://localhost:9001/user/1/avatar", form);
  yield return www;
}
```

成功返回:

```json
{
  "status": 0,
  "msg": "Avatar updated"
}
```

失败返回：

**同 更新用户信息**

#### GET - `/user/:user_id/avatar` - 获取用户头像

请求:

空

成功返回:

图片二进制数据

#### GET - `/user/:user_id/friend` - 获取好友列表

请求:

```json
{
  "token": "your token"
}
```

成功返回:

```json
{
  "status": 0,
  "msg": "Get friend list success!",
  "data": [
    {
      "user_id": 3, // friend's user_id
      "nickname": "nickname",
      "avatar": "avatar in url",
      "exp": 233 // used to calculate level
    },
    // ...
  ]
}
```

失败返回:

```json
{
  "status": 1,
  "msg": "You can only know your friends"
}
```

#### POST - `/user/:user_id/friend` - 添加好友

请求:

```json
{
  "user_id": "friend's id",
  "token": "your own token"
}
```

成功返回:

```json
{
  "status": 0,
  "msg": "Add friend success!"
}
```

失败返回:

```json
{
  "status": 1,
  "msg": "Your friend doesn't exist"
}
```

```json
{
  "status": 2,
  "msg": "You can only change your own friends"
}
```

#### POST - `/user/:user_id/friend/:user_friend_id` - 删除好友

请求:

```json
{
  "token": "your token"
}
```

成功返回:

```json
{
  "status": 0,
  "msg": "Delete friend success!"
}
```

失败返回:

```json
{
  "status": 1,
  "msg": "Your friend doesn't exist"
}
```

```json
{
  "status": 2,
  "msg": "You can only delete your own friends"
}
```

```json
{
  "status": 3,
  "msg": "Duplicate friendship"
}
```