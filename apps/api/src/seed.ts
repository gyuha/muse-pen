import { parseArgs } from 'node:util';
import { createApp } from './app';

// 사용법(DB_PATH 환경 변수로 DB 지정):
//   pnpm --filter ./apps/api run seed -- admin --email a@b.com --password <8자 이상> [--name 이름]
//   pnpm --filter ./apps/api run seed -- invite [--count 3] [--code 직접지정]
const argv = process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--'));
const { positionals, values } = parseArgs({
  args: argv,
  allowPositionals: true,
  options: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' }, count: { type: 'string' }, code: { type: 'string' } },
});

const api = createApp({ dbPath: process.env.DB_PATH ?? './data/muse-pen.db', imageDir: process.env.IMAGE_DIR ?? './data/images', startWorker: false });
try {
  const [command] = positionals;
  if (command === 'admin') {
    if (!values.email || !values.password) throw new Error('admin: --email 과 --password 가 필요하다');
    const admin = await api.createAdmin(values.email, values.password, values.name);
    console.log(`관리자 준비됨: ${admin.email}`);
  } else if (command === 'invite') {
    const count = Number(values.count ?? 1);
    for (let i = 0; i < count; i++) console.log(api.createInvite(count === 1 ? values.code : undefined));
  } else {
    throw new Error('사용법: seed admin --email --password [--name] | seed invite [--count N] [--code C]');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await api.close();
}
