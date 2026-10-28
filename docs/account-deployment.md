# 账户与独立后台部署

## 当前边界

- 前台：`npm run build`，产物 `dist/`。
- 后台：`npm run build:admin`，产物 `dist-admin/`，发布路径 `/admin/`。
- `npm run dev` 仍是本机完整工作台。后台开发服务 `npm run dev:admin` 监听 `127.0.0.1:5180`，只代理账户及后台接口到前台开发服务 `127.0.0.1:5173`。
- `npm run start:accounts` 是另一个独立进程，只挂载账户、后台摘要及前后台静态页面。**不提供** Provider、素材文件、目录扫描、导入、工作区及模型生成接口；线上前台仍不等于完整本机产品。
- GitHub Pages / 当前 Vercel 静态部署不运行这个账户进程，也不持久化 SQLite。上传静态产物不能声称已打通线上注册登录。
- 当前没有短信、邮箱验证、忘记密码或第三方登录服务；不要在页面展示为已接入。

## 最小部署条件

需要一台已授权的 Node 22.22+ 主机、持久磁盘、HTTPS 反向代理及进程守护。单实例运行账户进程；不能放在会清空磁盘的 Serverless 实例上，不能以多个进程共享内存限流。未确认资源前不创建收费主机。

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run build:admin

export NODE_ENV=production
export LIZUO_PUBLIC_ORIGIN=https://lizuo.work
export LIZUO_ACCOUNT_DATABASE=/var/lib/lizuo/accounts.sqlite
export PORT=4190
npm run start:accounts
```

数据库目录由服务用户独占，备份不放进源码、静态目录或 Git。服务进程设置 `umask 077`。正式部署使用 systemd 或等效守护工具，不用临时终端充当生产进程管理。SQLite 开启 WAL；备份须用 SQLite 在线备份机制或停机后一起备份数据库及 WAL，不能只随手复制正在写入的主文件。

## 反向代理

仅将已经绑定证书的 `lizuo.work` 转发至 `127.0.0.1:4190`。原始 Host 必须保留，客户端 IP 由同机可信代理写入。例：

```nginx
location / {
    proxy_pass http://127.0.0.1:4190;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

HTTPS 服务应设置 HSTS、请求超时和边缘速率限制；HTTP 跳转 HTTPS。进程只监听回环地址，不对外开放 4190、5173、5180 或本机网关端口。应用仅信任回环代理，接口校验配置的 Host 和 Origin；Cookie 为 HttpOnly、Secure、SameSite=Lax。不要为绕过来源校验而开放通配 CORS。

## 管理员初始化

首次注册也只是普通成员，不存在默认管理员或默认密码。先由所有者在 HTTPS 页面注册自己的邮箱，然后由有主机权限的运维人员执行：

```sh
LIZUO_ACCOUNT_DATABASE=/var/lib/lizuo/accounts.sqlite npm run account:admin -- 所有者已注册邮箱
```

此命令不创建用户，不设置密码，不提供 Web 提权接口。开发环境如需管理本机账户，也须明确指向实际本地资产库的数据库；不要把生产账户库和本机资产库混用。后台显示当前所连数据库的用户、有效会话与资产数；独立线上账户库没有同步本机素材，资产为零并非本机素材总量。

## 上线验收与回滚

1. 验证域名绑定、证书及 HTTPS 前台，然后验证 `/admin/` 正确加载独立后台 JS/CSS。
2. 新注册普通成员，刷新保持身份；错误密码失败，退出后旧 Cookie 无效。
3. 匿名读取 `/api/admin/summary` 为 401，普通成员为 403；显式授权的管理员才可读取真实统计。
4. 重启账户进程，再登录确认数据持久；跨站 Origin 为 403，频繁登录为 429。
5. `/api/provider/config`、`/api/storage`、`/api/assets`、`/api/workspace` 等均应为 404，不泄露本机配置或文件。
6. 只有上述验收通过后才修改 `lizuo.work` DNS。不要修改 `hoodax.cc`。变更前保存旧解析以便回退。

回滚前备份账户库并停止写入，恢复前一 Git 提交构建和服务配置；数据库不随代码回退删除或覆盖。账号迁移只增不减，不能以重建空数据库代替回滚。GitHub Pages 只允许 main 发布，开发分支只构建，不绕过环境保护。
