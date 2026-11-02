# 실행 기록 — 에디터 한국어 IME 스파이크 시험 페이지와 체크리스트 (재실행 1회차)

실행: frontend#3A35(claude/claude-sonnet-5-5, auto, paseo d4efc82f), 브랜치 spike-editor-ime. 오케스트레이터가 DoD를 독립 재실행해 교차 검증함.

## Failed attempts
- 1: UAT에서 Plate 한글 입력이 밀려 보이고 정확히 입력되지 않음(사용자 보고). 원인 미분리 — Copilot 제안 DOM 삽입, 로그 setState에 따른 에디터 재렌더, 직접 구현한 "/" 메뉴가 후보 / 수정 시도(65b3dc5): 기본 모드 토글·로그 store 분리·조합 중 제안 미발생

## 슬라이스별 결과
- S1 BlockNote 0.57.0·Plate(platejs 53.5.2 외) 정확한 버전 고정 — ⚠ pnpm 엄격 모드로 직접 의존성 7종 추가(1회차와 동일, 재실행에서 의존성 변경 없음)
- S2 시험 페이지 — ⚠ 1회차 UAT 실패(Plate 입력 밀림, 원인 미분리)를 받아 수정(65b3dc5): 에디터별 "기본 모드(플러그인 없음)" 토글(기본 켜짐), 로그를 React 밖 store로 분리하고 렌더 카운터 표시, ghost text는 조합 중 숨김이 아니라 발생 자체를 막음. Plate "/" 메뉴는 여전히 직접 구현
- S3 체크리스트 — ⚠ 판정 규칙 추가: Enter·Backspace·클릭은 기본 모드 결과로 판정, 플러그인 모드에서만 실패하면 시험 코드/설정 문제로 기록. Plate "/" 칸 "직접 구현 결함 가능" 표시(3f3ba95)

## 계획과 달라진 점
- 계획에 없던 "기본 모드" 비교 축이 생김. 라이브러리 자체 판정(기본 모드)과 우리 연동 코드 판정(플러그인 모드)을 분리하기 위함.
- Plate "/"는 여전히 직접 구현이라 두 후보가 "/"에서 같은 조건이 아님.
- 자동 확인 한계: Playwright는 실제 IME 조합을 만들지 못함. 합성 compositionstart로 제안 미발생, 키 입력·로그 증가(12→22건) 중 렌더 카운터 1 유지만 확인(에이전트 보고).

## DoD baseline → after (오케스트레이터 재실행)
1. typecheck+build: exit 0 → exit 0 (회귀 방지, 유지)
2. dist html 1·흔적 0 → 1·0 (회귀 방지, dist 삭제 후 새 빌드)
3. 정확한 버전 검사: exit 1 → exit 0
4. web test: exit 0 → 8 passed
5. spike-ime.html: 없음 → 있음
6. CHECKLIST.md "미시험": 없음 → 8줄
7. 사람 확인: UAT에서 확인
8. 로컬 커밋: 363b380, d635402, 3f3ba95, 65b3dc5 (push 안 함)

## 후속 작업 후보

<!-- followup: fu-940a5ec716c1 | source: editor-ime-spike-harness | task: 9 | date: 2026-11-02 | status: open | taken: - -->
- 결과 반영(플랜 2): 사용자가 CHECKLIST.md의 Mac 4행(기본 모드·플러그인 모드)을 채운 뒤 fg-ask로 그릴링해 채택 라이브러리 확정, 탈락 라이브러리·시험 코드 정리, docs/06·docs/08 기록, ADR 261101-233610에 "Windows 미검증 상태로 채택" 추가.
  Evidence: 이번 UAT는 브라우저 1개·일반 입력 중심 확인이며, 조합 중 Enter·Safari·Plate 플러그인 모드는 아직 판정되지 않음.
