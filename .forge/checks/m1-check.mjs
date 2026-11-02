#!/usr/bin/env node
// fg-loop 멈춤 조건 검사 — M1 기반 구축. 사용법: node .forge/checks/m1-check.mjs <K1..K7|all>
// 이 파일과 m1-acceptance.md는 루프 계약의 일부다. 드라이브 중 수정 금지(loop.md 재계획 범위 참고).
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const PKGS = ['apps/web', 'apps/api', 'packages/shared', 'packages/story-engine', 'packages/image-engine'];
const ALL_PKGS = [...PKGS, 'tests'];
const AC_IDS = Array.from({ length: 16 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);

function sh(cmd, timeout = 20 * 60 * 1000) {
  const r = spawnSync('bash', ['-lc', cmd], { cwd: ROOT, encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` };
}
const tail = (s, n = 400) => s.trim().slice(-n).replace(/\s+/g, ' ');
const pkgJson = (p) => (existsSync(join(ROOT, p, 'package.json')) ? JSON.parse(readFileSync(join(ROOT, p, 'package.json'), 'utf8')) : null);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (['node_modules', 'dist', 'build', '.reports', '.turbo', 'coverage', '.vite'].includes(e)) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const srcFiles = (p) => walk(join(ROOT, p)).filter((f) => /\.(ts|tsx|js|mjs|cjs|sql)$/.test(f));

const checks = {
  K1() {
    const missing = [];
    for (const p of ALL_PKGS) {
      const j = pkgJson(p);
      if (!j) { missing.push(`${p}/package.json 없음`); continue; }
      const need = p === 'tests' ? ['typecheck', 'test:accept'] : ['typecheck', 'build', 'test'];
      for (const s of need) if (!j.scripts?.[s]) missing.push(`${p} 스크립트 ${s} 없음`);
    }
    if (!existsSync(join(ROOT, 'pnpm-workspace.yaml'))) missing.push('pnpm-workspace.yaml 없음');
    if (!existsSync(join(ROOT, 'pnpm-lock.yaml'))) missing.push('pnpm-lock.yaml 없음');
    if (missing.length) return [false, missing.join(' | ')];
    const r = sh('pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r --filter "!./tests" build');
    return [r.code === 0, r.code === 0 ? 'install·typecheck·build 성공' : `실패(exit ${r.code}): ${tail(r.out)}`];
  },
  K2() {
    const errs = [];
    for (const p of PKGS) {
      const n = walk(join(ROOT, p)).filter((f) => /\.test\.(ts|tsx)$/.test(f)).length;
      if (n === 0) errs.push(`${p} 테스트 파일 0개`);
    }
    if (errs.length) return [false, errs.join(' | ')];
    const r = sh('pnpm -r --filter "!./tests" test');
    return [r.code === 0, r.code === 0 ? '5개 패키지 단위 테스트 통과' : `실패(exit ${r.code}): ${tail(r.out)}`];
  },
  K3() {
    const rep = join(ROOT, 'tests/.reports');
    rmSync(rep, { recursive: true, force: true });
    const r = sh('pnpm --filter ./tests run test:accept', 40 * 60 * 1000);
    const results = []; // {title, status}
    const vf = join(rep, 'vitest.json');
    const pf = join(rep, 'playwright.json');
    if (existsSync(vf)) {
      const v = JSON.parse(readFileSync(vf, 'utf8'));
      for (const tr of v.testResults || []) for (const a of tr.assertionResults || []) results.push({ title: a.fullName || a.title, status: a.status });
    }
    if (existsSync(pf)) {
      const p = JSON.parse(readFileSync(pf, 'utf8'));
      const visit = (s, prefix) => {
        for (const sp of s.specs || []) for (const t of sp.tests || []) {
          const last = (t.results || []).at(-1);
          const st = t.status === 'skipped' || !last ? 'skipped' : last.status === 'passed' ? 'passed' : 'failed';
          results.push({ title: `${prefix} ${sp.title}`, status: st });
        }
        for (const c of s.suites || []) visit(c, `${prefix} ${c.title}`);
      };
      for (const s of p.suites || []) visit(s, s.title);
    }
    const errs = [];
    if (!existsSync(vf)) errs.push('vitest.json 없음');
    if (!existsSync(pf)) errs.push('playwright.json 없음');
    const bad = results.filter((x) => x.status !== 'passed');
    if (bad.length) errs.push(`통과 아님 ${bad.length}건: ${bad.slice(0, 5).map((x) => `${x.title}(${x.status})`).join(', ')}`);
    for (const id of AC_IDS) {
      if (!results.some((x) => x.title.includes(`[${id}]`) && x.status === 'passed')) errs.push(`${id} 통과 테스트 없음`);
    }
    if (r.code !== 0 && !errs.length) errs.push(`test:accept exit ${r.code}: ${tail(r.out)}`);
    const passed = results.filter((x) => x.status === 'passed').length;
    return [errs.length === 0, errs.length ? errs.join(' | ') : `AC 16개 모두 통과 · 테스트 ${passed}개 통과 · 실패·건너뜀 0`];
  },
  K4() {
    const hits = [];
    for (const f of [...srcFiles('apps/api'), ...srcFiles('packages/shared')]) {
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        if (/fts5|json_extract|json_each|json_set|json_group|autoIncrement|AUTOINCREMENT/i.test(l)) hits.push(`${relative(ROOT, f)}:${i + 1}`);
      });
    }
    const api = pkgJson('apps/api');
    const hasDrizzle = !!(api && { ...api.dependencies, ...api.devDependencies }['drizzle-orm']);
    const errs = [];
    if (!hasDrizzle) errs.push('apps/api에 drizzle-orm 의존성 없음');
    if (hits.length) errs.push(`SQLite 전용 기능·자동 증가 사용: ${hits.slice(0, 8).join(', ')}`);
    return [errs.length === 0, errs.length ? errs.join(' | ') : 'drizzle-orm 사용 · SQLite 전용 기능·자동 증가 0건'];
  },
  K5() {
    const sdk = /from\s+['"](@anthropic-ai\/sdk|@google\/genai|openai|@fal-ai\/client)['"]|require\(['"](@anthropic-ai\/sdk|@google\/genai|openai|@fal-ai\/client)['"]\)/;
    const errs = [];
    for (const p of PKGS) for (const f of srcFiles(p)) {
      if (sdk.test(readFileSync(f, 'utf8')) && !relative(ROOT, f).includes('/providers/')) errs.push(`SDK import 경계 위반 ${relative(ROOT, f)}`);
    }
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    const key = /sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|\bsk-[A-Za-z0-9]{32,}/;
    for (const f of tracked) {
      if (!existsSync(join(ROOT, f)) || statSync(join(ROOT, f)).size > 2_000_000) continue;
      if (key.test(readFileSync(join(ROOT, f), 'utf8'))) errs.push(`키 형태 문자열 ${f}`);
    }
    return [errs.length === 0, errs.length ? errs.join(' | ') : `SDK import는 providers/ 안에만 · 추적 파일 ${tracked.length}개에 키 형태 0건`];
  },
  K6() {
    const f = 'infra/docker-compose.yml';
    if (!existsSync(join(ROOT, f))) return [false, `${f} 없음`];
    const q = sh(`docker compose -f ${f} config -q`);
    if (q.code !== 0) return [false, `config 실패: ${tail(q.out)}`];
    const j = sh(`docker compose -f ${f} config --format json`);
    let cfg;
    try { cfg = JSON.parse(j.out.slice(j.out.indexOf('{'))); } catch { return [false, `config json 파싱 실패: ${tail(j.out)}`]; }
    const names = Object.keys(cfg.services || {});
    const errs = [];
    for (const s of ['caddy', 'api', 'litestream']) if (!names.some((n) => n.includes(s))) errs.push(`${s} 서비스 없음`);
    const api = cfg.services[names.find((n) => n.includes('api'))] || {};
    const reps = api.deploy?.replicas;
    if (reps !== undefined && reps !== 1) errs.push(`api replicas ${reps}`);
    const vols = JSON.stringify(api.volumes || []);
    if (!/sqlite|db|data/i.test(vols)) errs.push('api에 SQLite 볼륨 없음');
    if (!/image/i.test(vols)) errs.push('api에 이미지 볼륨 없음');
    return [errs.length === 0, errs.length ? errs.join(' | ') : `서비스 ${names.join(',')} · api 단일 인스턴스 · SQLite·이미지 볼륨`];
  },
  K7() {
    const d = sh('node .forge/checks/docs-check.mjs all');
    const errs = [];
    if (d.code !== 0) errs.push(`docs-check 실패: ${tail(d.out)}`);
    const base = join(ROOT, '.forge/checks/m1-hashes.txt');
    for (const [hash, p] of readFileSync(base, 'utf8').trim().split('\n').map((l) => l.split(/\s+/))) {
      const fp = join(ROOT, p);
      if (!existsSync(fp) || createHash('sha256').update(readFileSync(fp)).digest('hex') !== hash) errs.push(`계약 파일 변경 ${p}`);
    }
    return [errs.length === 0, errs.length ? errs.join(' | ') : 'docs-check 통과 · M1 계약 파일 해시 일치'];
  },
};

const arg = process.argv[2] || 'all';
const ids = arg === 'all' ? Object.keys(checks) : [arg];
let ok = true;
for (const id of ids) {
  if (!checks[id]) { console.error(`알 수 없는 검사: ${id}`); process.exit(64); }
  let pass, ev;
  try { [pass, ev] = checks[id](); } catch (e) { pass = false; ev = `검사 오류: ${e.message}`; }
  console.log(`${id} ${pass ? 'pass' : 'fail'} — ${ev}`);
  ok &&= pass;
}
process.exit(ok ? 0 : 1);
