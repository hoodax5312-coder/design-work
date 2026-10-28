import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLibraryDatabase } from './database';
import { createAccountApp } from './createAccountApp';

const databasePath = process.env.LIZUO_ACCOUNT_DATABASE;
const publicOrigin = process.env.LIZUO_PUBLIC_ORIGIN;
if (!databasePath || !path.isAbsolute(databasePath) || !publicOrigin) {
  throw new Error('必须配置持久卷上的绝对路径 LIZUO_ACCOUNT_DATABASE 和 HTTPS 来源 LIZUO_PUBLIC_ORIGIN');
}
process.umask(0o077);
const database = openLibraryDatabase(databasePath);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = createAccountApp({ database, publicOrigin, projectRoot });
// A same-machine HTTPS reverse proxy must forward the original Host header.
const server = app.listen(Number(process.env.PORT || 4190), '127.0.0.1', () => {
  console.log('栗作独立账户服务已启动，仅监听本机反向代理端口');
});
const stop = () => server.close(() => { database.close(); });
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
