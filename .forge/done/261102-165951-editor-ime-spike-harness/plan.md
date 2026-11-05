<!-- forge-slug: editor-ime-spike-harness -->
<!-- task: 16 -->
<!-- priority: high -->
<!-- tdd: off -->
# 에디터 한국어 IME 스파이크 — 시험 페이지와 체크리스트 구축

## Goal / Non-goals
- Goal: BlockNote와 Plate를 같은 조건에서 사람이 실제 키보드로 시험할 수 있도록 apps/web에 dev 전용 시험 페이지(`spike-ime.html`)와 70칸 체크리스트 양식을 만든다. 판정은 이 작업 이후 사용자가 Mac 4개 브라우저에서 직접 채운 체크리스트로 내린다.
- 담당: frontend 역할(apps/web).
- 시험 페이지 구성(그릴링 합의):
  - 두 에디터를 나란히 띄운다. 라이브러리 버전은 정확한 버전으로 고정한다(Plate는 내부 엔진 교체가 진행 중이라 버전 고정이 특히 중요 — docs/06:91).
  - "/" 메뉴: 각 라이브러리의 기본 제공 기능을 그대로 쓰고, `이어쓰기`·`초안` 같은 한글 항목 몇 개로 한글 필터링을 시험할 수 있게 한다.
  - ghost text: Plate는 기본 제공 Copilot 플러그인, BlockNote는 최소 decoration을 직접 구현한다. 둘 다 "조합 중에는 CSS로 숨김" 규칙(docs/06:116)을 적용한다. 제안 문장은 고정된 가짜 문자열이고, 입력이 멈추고 일정 시간이 지나면 띄운다. AI 호출과 API 키는 없다.
  - 조합 이벤트 로그 패널: 입력하는 동안 `compositionstart`/`compositionupdate`/`compositionend`/`beforeinput`/`keydown`(Enter·Backspace)을 순서대로 화면에 기록한다. 실패했을 때 원인을 남기기 위해서다.
  - Pretendard 정적 빌드는 `apps/web/index.html:7`과 같은 CDN `<link>`를 쓴다.
- 체크리스트(`apps/web/src/spike-ime/CHECKLIST.md`):
  - 환경 7행(macOS × Chrome·Safari·Firefox·Edge / Windows × Chrome·Firefox·Edge) × 시험 항목 5개(조합 중 Enter, 조합 중 Backspace, 조합 중 클릭, "/" 메뉴 한글 입력, ghost text) × 후보 2개 = 70칸. 칸마다 통과/실패와 메모를 적는다.
  - Windows 3행은 "미시험"으로 미리 표시한다. 이번 판정은 Mac 4행으로 하고, Windows는 나중에 같은 저장소를 받아 `pnpm --filter @muse-pen/web dev`로 이어서 채운다.
  - BlockNote의 ghost text 칸에는 "직접 구현 결함 가능" 표시를 붙인다. 판정은 Enter·Backspace·클릭·"/" 네 항목을 중심으로 하고, 이 칸은 참고로만 쓴다.
  - 시험한 패키지 버전과 브라우저 버전을 적는 칸을 둔다.
  - docs/06의 결정 규칙(하나만 통과 → 그것, 둘 다 → Plate, 둘 다 실패 → Lexical 검토)을 함께 적는다.
- Non-goals:
  - 시험 실행과 판정 — 사람이 하는 일이다. 이 플랜은 사람의 확인이 필요한 지점에서 끝난다.
  - 결과 반영: 채택, 탈락한 라이브러리 제거, docs/06·docs/08 기록, ADR에 "Windows 미검증 상태로 채택" 한 줄 추가. 체크리스트가 채워진 뒤 별도로 그릴링해 플랜을 쓴다. 결과에 따라 내용이 달라지므로 미리 쓰지 않는다.
  - 실제 회차 에디터, 기존 앱 라우터 연결, AI 호출, 운영 빌드 포함, 배포.
  - docs/·.forge/ 수정.

## Source of truth
- Glossary terms: none(이 작업은 도메인 용어를 새로 다루지 않는다)
- Related ADRs: .forge/adr/261101-233610-editor-ime-spike-gate-block-json.md
- 문서: docs/06-editor-and-ai-ux.md(에디터 라이브러리 — 결정 규칙, 조사 근거, 스파이크 시험 매트릭스, ghost text 표시 규칙, 한국어 웹폰트), docs/08-build-plan.md(1단계 스파이크)
- Definition of Done(작성 시점에 각 명령을 한 번씩 실행해 사전 상태를 기록함):
  1. `pnpm --filter @muse-pen/web typecheck && pnpm --filter @muse-pen/web build` → exit 0
     - 사전 상태: 통과. 회귀 방지 항목이다. 시험 코드가 `src/` 아래에 들어오면 이 명령이 그 코드도 검사한다.
  2. 위 빌드 직후 `ls apps/web/dist/*.html | wc -l` → 1(`index.html`만 있음), 그리고 `grep -rlE 'spike-ime|blocknote|platejs' apps/web/dist | wc -l` → 0
     - 사전 상태: 1과 0으로 통과. 회귀 방지 항목이다. `vite.config.ts`에 `build.rollupOptions.input`이 없어서 빌드 진입점은 `index.html` 하나다.
     - 0이라는 결과는 1번 빌드가 exit 0이고 `dist/`가 새로 생긴 경우에만 근거로 인정한다. 명령이 실패해도 0이 나오기 때문이다.
  3. `node -e "const p=require('./apps/web/package.json');const d={...p.dependencies,...p.devDependencies};const k=Object.keys(d).filter(n=>/blocknote|platejs|@udecode/.test(n));const bad=k.filter(n=>/^[\^~]/.test(d[n]));process.exit(k.length>=2&&bad.length===0?0:1)"` → exit 0
     - 사전 상태: 라이브러리 0개로 실패. 앞으로 충족해야 할 항목이다.
  4. `pnpm --filter @muse-pen/web test` → exit 0
     - 사전 상태: 통과. 회귀 방지 항목이다.
  5. `test -f apps/web/spike-ime.html` → exit 0
     - 사전 상태: 실패. 앞으로 충족해야 할 항목이다.
  6. `test -f apps/web/src/spike-ime/CHECKLIST.md && [ $(grep -c '미시험' apps/web/src/spike-ime/CHECKLIST.md) -ge 3 ]` → exit 0
     - 사전 상태: 실패. 앞으로 충족해야 할 항목이다.
  7. (사람 확인) `pnpm --filter @muse-pen/web dev`를 띄운 뒤 `/spike-ime.html`에서 다음이 모두 보인다.
     - 두 에디터가 나란히 뜬다.
     - 각 에디터에서 "/" 입력 시 한글 메뉴가 열린다.
     - 입력을 멈추면 가짜 ghost text가 뜨고, 한글을 조합하는 동안에는 숨는다.
     - 로그 패널에 조합 이벤트가 기록된다.
  8. frontend 역할의 로컬 커밋이 1개 이상 있다.

## Work slices
- [ ] S1. 의존성 추가 — BlockNote(`@blocknote/core`·`@blocknote/react` 및 필요한 UI 패키지)와 Plate(`platejs` 및 slash command·Copilot에 필요한 패키지)를 apps/web에 정확한 버전으로 고정해 추가한다. lockfile 갱신은 이 작업 하나만 한다. — completion criterion: DoD 3 exit 0
- [ ] S2. 시험 페이지 — `apps/web/spike-ime.html`과 `apps/web/src/spike-ime/`에 두 에디터, 한글 "/" 메뉴, ghost text(조합 중 CSS로 숨김, 가짜 문자열), 조합 이벤트 로그 패널, Pretendard CDN 링크를 구현한다. 기존 `src/main.tsx`·라우터에는 연결하지 않는다. — completion criterion: DoD 1·2·4·5 통과 (depends: S1)
- [ ] S3. 체크리스트 양식 — `apps/web/src/spike-ime/CHECKLIST.md`에 70칸 표, Windows 3행 "미시험", BlockNote ghost text 칸의 "직접 구현 결함 가능" 표시, 버전 기록 칸, 결정 규칙, 시험 페이지를 띄우는 방법을 적는다. — completion criterion: DoD 6 exit 0 (depends: S2)
