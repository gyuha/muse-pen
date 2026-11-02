# RUN — M1 3/5 — apps/api: 인증·CRUD·작업 테이블·SSE·이미지·사용 기록

## 슬라이스 결과
- S1 Drizzle 스키마·마이그레이션·저장소 계층 — ✅ as planned (drizzle/0000_init.sql, K4 pass)
- S2 인증·초대·관리자 재설정·소유권·시드 CLI — ⚠ 초대 거절은 400(better-auth 훅이 403을 중복 가입으로 처리), 코드는 가입 전에 선점되어 이후 실패 시 소진된 채 남음
- S3 CRUD 전체 — ⚠ 시놉시스·플롯 메모·회차 요약은 블록 JSON이 아닌 일반 문자열로 단순화
- S4 작업 테이블·워커·SSE·이미지·사용 기록·앱 팩토리 — ⚠ 스트림을 끝까지 소비하지 않으면(클라이언트 중단) 그 호출의 사용 기록이 남지 않음

## 계획과 실제의 차이
- 실행: backend#33A1(f49cd196)에 send로 이어서 위임. api 테스트 8파일 41개.
- shared 변경: 화풍 프리셋 레퍼런스 1~3장 → 0~3장(작품 생성 시점에 이미지가 없을 수 있음 — 오케스트레이터 지시). 문서의 "레퍼런스 1~3장"과 차이가 있으므로 사람 검토 대상. jobSchema에 workId·result 추가.
- 실행 방식: start/dev는 tsx로 실행(워크스페이스 패키지가 TS 소스를 export). `node dist`로는 실행 불가 — deploy가 컨테이너 실행 방식을 정해야 함.
- 추정 비용 단가표가 비어 있어 텍스트 추정 비용은 0으로 기록(단가를 추측하지 않음, `createApp({ pricing })`로 주입).
- 계획에 없던 추가 구현: 필드 변경 제안 수락·거절, ghost text·설정 점검·자료 조사 엔드포인트, 화풍 레퍼런스 업로드.

## DoD baseline → after
- `pnpm --filter ./apps/api test`: 0개(통과) → 41 passed
- `pnpm --filter ./apps/api build`: — → exit 0
- K4: pass(공허한 통과) → pass(schema.ts 존재, 금지 패턴 0)
- K5: pass → pass (회귀 방지)
- 커밋: ad8a500

## Rulings
- 실행기: 기존 backend 에이전트에 send로 이어서 위임(팀 규칙 "같은 작업 줄기는 기존 에이전트 재사용").
- 화풍 프리셋 순서 문제를 "생성 시 0장 허용"으로 지시 — 문서 결정의 세부 구현 해석.
