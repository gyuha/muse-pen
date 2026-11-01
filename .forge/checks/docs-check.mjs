#!/usr/bin/env node
// fg-loop 멈춤 조건 검사 — docs/ 제작 문서. 사용법: node .forge/checks/docs-check.mjs <C1..C9|all>
// 이 파일은 루프 계약의 일부다. 드라이브 중 수정 금지(loop.md 재계획 범위 참고).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const DOCS = join(ROOT, 'docs');
const FILES = [
  'README.md', '01-product.md', '02-architecture.md', '03-data-model.md', '04-story-engine.md',
  '05-image-engine.md', '06-editor-and-ai-ux.md', '07-research.md', '08-build-plan.md', '09-decisions.md',
];
const read = (p) => readFileSync(p, 'utf8');
const doc = (f) => (existsSync(join(DOCS, f)) ? read(join(DOCS, f)) : '');
const has = (text, kw) => text.toLowerCase().includes(kw.toLowerCase());

// 결정 28개 → 문서 · 핵심어 (agenda.md "결정됨" 순서)
const DECISIONS = [
  ['D01', '01-product.md', ['작가 1명', '공동 집필']],
  ['D02', '01-product.md', ['초대', '자기 작품']],
  ['D03', '01-product.md', ['이어쓰기', '문체 다듬기', '회차 초안', '줄거리 구상', '자료 조사', '캐릭터', '장소', '소품']],
  ['D04', '02-architecture.md', ['이메일', '비밀번호', '초대 코드', '관리자', '재설정']],
  ['D05', '03-data-model.md', ['정형 필드', '설정 본문']],
  ['D06', '03-data-model.md', ['캐릭터', '장소', '소품', '세계관', '컨셉', '화풍 프리셋', '외형 키워드', '상태', '대표 이미지', '소유자']],
  ['D07', '06-editor-and-ai-ux.md', ['선택 영역', '/이어쓰기', '사이드', 'ghost text']],
  ['D08', '06-editor-and-ai-ux.md', ['AI 제안', '수락', '거절', '다시 생성', '회차 스냅샷', '복원']],
  ['D09', '04-story-engine.md', ['정형 필드', '별칭', '고정 설정', '임베딩']],
  ['D10', '04-story-engine.md', ['사망', '행방불명', '설정 점검']],
  ['D11', '04-story-engine.md', ['ghost text', '조합', '한 문장', '끄기']],
  ['D12', '04-story-engine.md', ['회차 요약', '직전', '전문']],
  ['D13', '04-story-engine.md', ['필드 변경', '현재 값']],
  ['D14', '04-story-engine.md', ['시놉시스', '플롯 메모', '사이드 패널']],
  ['D15', '04-story-engine.md', ['Claude', '인터페이스', '다중 공급자']],
  ['D16', '02-architecture.md', ['서비스 키', 'BYOK']],
  ['D17', '03-data-model.md', ['사용 기록', '추정 비용']],
  ['D18', '02-architecture.md', ['pnpm', 'apps/web', 'apps/api', 'packages/shared', 'packages/story-engine', 'packages/image-engine']],
  ['D19', '02-architecture.md', ['Vite', 'React', 'SPA']],
  ['D20', '02-architecture.md', ['Hono', 'SSE', 'RPC', 'zod']],
  ['D21', '03-data-model.md', ['Drizzle', 'SQLite', 'PostgreSQL', 'ULID', 'FTS5']],
  ['D22', '05-image-engine.md', ['저장소 인터페이스', '로컬 디스크', '권한']],
  ['D23', '02-architecture.md', ['작업 테이블', '워커', 'Redis']],
  ['D24', '02-architecture.md', ['VPS', 'Docker Compose', 'Caddy', 'Litestream', '단일 인스턴스', '지출 한도']],
  ['D25', '07-research.md', ['web_search', 'web_fetch', 'Tavily', 'robots.txt', '네이버']],
  ['D26', '07-research.md', ['출처', '150자', '원문', '고정', '토큰 상한']],
  ['D27', '05-image-engine.md', ['대표 이미지', '화풍 프리셋', 'Nano Banana 2.1', 'Nano Banana Pro', '모델 ID', 'FLUX', '검열']],
  ['D28', '06-editor-and-ai-ux.md', ['BlockNote', 'Plate', 'Lexical', 'IME', '스파이크', '블록 JSON', 'Markdown', 'Pretendard']],
];
// 제작 계획 문서가 검증 스파이크 3개와 역할 6개를 다루는지
const BUILD_PLAN = ['08-build-plan.md', ['IME', '일관성', '검열', '검색 품질', 'frontend', 'backend', 'story', 'imagery', 'qa', 'deploy']];

const OUT_OF_SCOPE = ['결제', '독자', 'DBMS', '모바일', '동시 편집'];
const FOG = ['시점별', '장면 삽화', '내보내기', '프롬프트 템플릿', '평가', 'LoRA'];

// GitHub 방식 앵커 슬러그
function slugs(text) {
  const seen = new Map();
  const out = new Set();
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    let s = m[1].replace(/`/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
    const n = seen.get(s) || 0;
    seen.set(s, n + 1);
    out.add(n ? `${s}-${n}` : s);
  }
  return out;
}

function links(text) {
  const out = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) out.push(m[1]);
  }
  return out;
}

// 상대 링크 하나를 해석: 대상 파일과 앵커가 실제로 있는지
function resolveLink(fromFile, href) {
  if (/^(https?:|mailto:)/.test(href)) return null;
  const [path, anchor] = href.split('#');
  const target = path ? resolve(DOCS, path) : join(DOCS, fromFile);
  if (!existsSync(target)) return `${fromFile}: 대상 없음 ${href}`;
  if (anchor !== undefined && target.endsWith('.md')) {
    if (!slugs(read(target)).has(decodeURIComponent(anchor))) return `${fromFile}: 앵커 없음 ${href}`;
  }
  return null;
}

const checks = {
  C1() {
    const bad = FILES.filter((f) => !existsSync(join(DOCS, f)) || statSync(join(DOCS, f)).size === 0);
    return [bad.length === 0, bad.length ? `없음/빈 파일: ${bad.join(', ')}` : `${FILES.length}개 모두 존재`];
  },
  C2() {
    const miss = [];
    for (const [id, f, kws] of [...DECISIONS, ['B', ...BUILD_PLAN]]) {
      const t = doc(f);
      const lack = kws.filter((k) => !has(t, k));
      if (lack.length) miss.push(`${id}(${f}): ${lack.join(', ')}`);
    }
    return [miss.length === 0, miss.length ? `누락 ${miss.length}건 — ${miss.join(' | ')}` : '결정 28개 + 제작 계획 핵심어 모두 존재'];
  },
  C3() {
    const t = doc('09-decisions.md');
    const rows = t.split('\n').filter((l) => /^\|\s*D\d{2}\s*\|/.test(l));
    const ids = new Set(rows.map((l) => /D\d{2}/.exec(l)[0]));
    const errs = [];
    for (let i = 1; i <= 28; i++) {
      const id = `D${String(i).padStart(2, '0')}`;
      if (!ids.has(id)) errs.push(`${id} 행 없음`);
    }
    if (rows.length !== 28) errs.push(`행 수 ${rows.length} (기대 28)`);
    for (const row of rows) {
      const docLinks = links(row).filter((h) => /^0\d-[^/]+\.md#/.test(h));
      if (!docLinks.length) errs.push(`${/D\d{2}/.exec(row)[0]}: 문서#앵커 링크 없음`);
      for (const h of docLinks) {
        const e = resolveLink('09-decisions.md', h);
        if (e) errs.push(e);
      }
    }
    return [errs.length === 0, errs.length ? errs.join(' | ') : '28행 · 모든 링크가 실제 제목을 가리킴'];
  },
  C4() {
    const t = doc('09-decisions.md');
    const adrs = readdirSync(join(ROOT, '.forge/adr')).filter((f) => f.endsWith('.md'));
    const hrefs = links(t);
    const errs = [];
    for (const a of adrs) {
      const h = hrefs.find((x) => x.endsWith(`.forge/adr/${a}`));
      if (!h) errs.push(`링크 없음 ${a}`);
      else if (resolveLink('09-decisions.md', h)) errs.push(`열리지 않음 ${h}`);
    }
    return [errs.length === 0, errs.length ? errs.join(' | ') : `ADR ${adrs.length}개 모두 링크됨`];
  },
  C5() {
    const t = doc('01-product.md');
    const terms = [...read(join(ROOT, '.forge/CONTEXT.md')).matchAll(/^\*\*(.+?)\*\*:/gm)].map((m) => m[1]);
    const lack = [...terms, ...OUT_OF_SCOPE, ...FOG].filter((k) => !has(t, k));
    return [lack.length === 0, lack.length ? `01-product.md 누락: ${lack.join(', ')}` : `용어 ${terms.length}개 · 범위 밖 ${OUT_OF_SCOPE.length}개 · 흐림 ${FOG.length}개 모두 존재`];
  },
  C6() {
    const errs = [];
    let n = 0;
    for (const f of FILES) {
      for (const h of links(doc(f))) {
        n++;
        const e = resolveLink(f, h);
        if (e) errs.push(e);
      }
    }
    return [errs.length === 0 && n > 0, errs.length ? errs.join(' | ') : `링크 ${n}개 모두 유효`];
  },
  C7() {
    const hits = [];
    for (const f of FILES) {
      doc(f).split('\n').forEach((l, i) => {
        if (/TODO|TBD|FIXME|작성 예정|추후 작성/i.test(l)) hits.push(`${f}:${i + 1}`);
      });
    }
    return [hits.length === 0 && FILES.every((f) => doc(f)), hits.length ? `발견: ${hits.join(', ')}` : '자리표시자 없음'];
  },
  C8() {
    const errs = [];
    const needFlow = ['02-architecture.md', '04-story-engine.md', '06-editor-and-ai-ux.md', '08-build-plan.md'];
    for (const f of FILES) {
      const lines = doc(f).split('\n');
      let flows = 0;
      for (let i = 0; i < lines.length; i++) {
        if (!/^```/.test(lines[i])) continue;
        const lang = lines[i].slice(3).trim();
        let j = i + 1;
        while (j < lines.length && !/^```/.test(lines[j])) j++;
        const body = lines.slice(i + 1, j).join('\n');
        if (lang === 'mermaid') {
          flows++;
          if (!/\bstyle\s|classDef\s/.test(body)) errs.push(`${f}:${i + 1} mermaid에 style/classDef 없음`);
          let k = i - 1;
          while (k >= 0 && lines[k].trim() === '') k--;
          const prev = k >= 0 ? lines[k].trim() : '';
          if (!prev || /^#/.test(prev) || /^```/.test(prev) || /^\|/.test(prev)) errs.push(`${f}:${i + 1} mermaid 앞에 설명 문단 없음`);
        } else if (body.includes('→')) flows++;
        i = j;
      }
      if (needFlow.includes(f) && flows === 0) errs.push(`${f}: 흐름도 없음`);
    }
    return [errs.length === 0 && FILES.every((f) => doc(f)), errs.length ? errs.join(' | ') : '흐름도 규칙 충족'];
  },
  C9() {
    const base = join(ROOT, '.forge/checks/source-hashes.txt');
    const want = read(base).trim().split('\n').map((l) => l.split(/\s+/));
    const errs = [];
    for (const [hash, p] of want) {
      const fp = join(ROOT, p);
      if (!existsSync(fp)) { errs.push(`사라짐 ${p}`); continue; }
      if (createHash('sha256').update(readFileSync(fp)).digest('hex') !== hash) errs.push(`변경됨 ${p}`);
    }
    const adrNow = readdirSync(join(ROOT, '.forge/adr')).filter((f) => f.endsWith('.md')).length;
    const adrBase = want.filter(([, p]) => p.startsWith('.forge/adr/')).length;
    if (adrNow !== adrBase) errs.push(`ADR 수 ${adrNow} (기준 ${adrBase})`);
    return [errs.length === 0, errs.length ? errs.join(' | ') : `원본 ${want.length}개 해시 일치`];
  },
};

const arg = process.argv[2] || 'all';
const ids = arg === 'all' ? Object.keys(checks) : [arg];
let ok = true;
for (const id of ids) {
  if (!checks[id]) { console.error(`알 수 없는 검사: ${id}`); process.exit(64); }
  const [pass, ev] = checks[id]();
  console.log(`${id} ${pass ? 'pass' : 'fail'} — ${ev}`);
  ok &&= pass;
}
process.exit(ok ? 0 : 1);
