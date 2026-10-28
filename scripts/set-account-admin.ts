import path from 'node:path';
import { openLibraryDatabase } from '../server/database';

const databasePath = process.env.LIZUO_ACCOUNT_DATABASE;
const email = process.argv[2]?.trim().toLowerCase();
if (!databasePath || !path.isAbsolute(databasePath) || !email) {
  throw new Error('用法：LIZUO_ACCOUNT_DATABASE=/持久目录/accounts.sqlite npm run account:admin -- 已注册邮箱');
}
process.umask(0o077);
const database = openLibraryDatabase(databasePath);
try {
  const result = database.prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE email = ?").run(Date.now(), email);
  if (result.changes !== 1) throw new Error('该邮箱尚未注册，未授予权限');
  console.log('已将指定账户设置为管理员；无默认管理员或默认密码。');
} finally {
  database.close();
}
