const minimum = [22, 22, 0];
const reportedVersion = process.argv[2] || process.versions.node;
const current = reportedVersion.split('.').map((value) => Number(value));

let comparison = 0;
for (let index = 0; index < minimum.length; index += 1) {
  const actual = current[index] || 0;
  if (actual === minimum[index]) continue;
  comparison = actual > minimum[index] ? 1 : -1;
  break;
}
const supported = comparison >= 0;

if (!supported) {
  console.error([
    `Mboard 需要 Node.js >= ${minimum.join('.')}，当前版本为 ${reportedVersion}。`,
    '请升级 Node.js 后重新运行该命令。',
  ].join('\n'));
  process.exit(1);
}
