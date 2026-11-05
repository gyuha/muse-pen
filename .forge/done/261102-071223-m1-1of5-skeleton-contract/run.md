# RUN — M1 1/5 — 모노레포 골격과 공용 계약(packages/shared)

## 슬라이스 결과
- S1 루트 설정 — ✅ as planned (pnpm-workspace에 6개 패키지)
- S2 패키지 골격·M1 의존성 일괄 설치 — ✅ as planned (better-auth, react-router, hono 4.13, drizzle, vitest 5, zod 4, TypeScript 6; tsx·@types/better-sqlite3 추가)
- S3 packages/shared 도메인 스키마·ImageStorage 타입·테스트 14개 — ⚠ 화풍 프리셋 레퍼런스 이미지 1~3장을 작품 생성 시 필수로 둬 생성 순서 문제 가능(3/5에서 결정 필요)
- S4 로컬 커밋 — ✅ ffea385

## 계획과 실제의 차이
- 실행은 backend 역할 에이전트(paseo backend#33A1, f49cd196)가 했다. 오케스트레이터가 DoD를 직접 재실행해 확인.
- TypeScript 6이 build에서 rootDir 명시를 요구해 tsconfig.build.json에 rootDir 추가.
- 테스트 파일이 없는 패키지는 `--passWithNoTests` — K2가 패키지별 테스트 파일 존재를 따로 요구하므로 우회되지 않음.
- 열거값은 영문 코드(alive/dead/missing 등), 시간은 ISO 8601 UTC 문자열, 블록 JSON은 z.unknown()(에디터 미정).
- 라이브러리 패키지 exports가 src/index.ts를 직접 가리킴 — api를 Node로 직접 실행하는 방식은 3/5에서 정해야 함.
- 화풍 프리셋 순서 문제: 작품 생성 전에는 레퍼런스 이미지가 존재할 수 없으므로 3/5(api)에서 작품 생성 입력 규칙을 정해야 한다.

## DoD baseline → after
- 필수 파일 누락 수: 6 → 0
- `pnpm install --frozen-lockfile && pnpm -r typecheck`: 실패 → exit 0
- `pnpm --filter ./packages/shared test`: 패키지 없음 → 14 passed
- K5: pass → pass, K7: pass → pass (회귀 방지)
- `git log main..m1-foundation --oneline`: 2 → 3줄

## Rulings
- 실행기: 사용자 결정(팀 역할 에이전트 + 브랜치 커밋)에 따라 fg-run 워크플로 대신 paseo backend 에이전트에 위임.
- 인증 라이브러리 better-auth, 라우터 react-router — backend 에이전트가 권장 기준으로 자동 선택, 오케스트레이터가 수용.
