# 실행 기록 — 이미지 일관성·검열 오탐 스파이크 (#10)

실행: 2026-11-03, 브랜치 `spike-image-consistency`. 팀 규칙에 따라 Dynamic Workflow 대신 Paseo 역할에 맡겼다. imagery(codex/gpt-6.1-sol, auto-review, agent `14b08cfe`)가 S1→S2→S3를 차례로 했고, S4(docs/05, 담당 역할 없음)는 오케스트레이터가 병렬로 했다.

## 슬라이스별 결과
- S1 엔진에 `direction` 추가 — ✅ 계획대로 (`0c6e126`)
- S2 Gemini 어댑터 — ✅ 계획대로. `@google/genai@2.32.0` 고정, SDK 재시도 1회로 제한 (`6ee6b3e`)
- S3 시험 장치 — ⚠ 검토 후 1회 수정. 처음 구현은 안전 차단이 아닌 오류에서 실행 전체가 중단되고 판정표를 끝에만 썼다. 오류 행 기록, 호출마다 판정표 저장, 이미지 없이 텍스트만 오는 응답용 `ImageNoImageError`를 추가했다 (`4d8329c`, `134228e`)
- S4 docs/05 갱신 — ✅ 계획대로 (`9b8d5f5`)

## 계획과 달라진 점
- 실행 수단: Dynamic Workflow 대신 Paseo imagery 역할에 맡겼다(팀 규칙).
- S3 결함 수정(위). 오케스트레이터 검토에서 발견했다. Gemini는 검열성 거절을 이미지 없이 텍스트로만 돌려줄 수 있어서[중간], 원래 구현으로는 검열 시험에서 실행이 바로 중단될 수 있었다. 판정표 상단에 "오류 N건 — 사람이 차단 여부 판정 필요"를 둔다.
- 계획에 없던 추가
  - `.env` 없이도 가짜 실행이 되도록 `--env-file-if-exists`를 썼다.
  - 실제 실행 전에 예상 비용이 $10을 넘으면 멈추는 가드를 넣었다.
  - `--fake-error` 옵션(오류 경로 확인용)을 넣었다.
  - 시험 장치까지 타입 검사하도록 tsconfig `include`에 `spike`를 추가했다.
- 비용 추정은 1K 이미지 출력 단가만 쓴다. 참조 이미지 입력 요금은 제외되므로 실제 청구액은 조금 더 나온다[추론].
- 작업 트리에 다른 세션(`/forge:fg-merge`, agent `e659a49`)의 미커밋 `.forge/` 통합 변경이 있었다. 모든 커밋은 경로를 지정해 했고, 그 변경은 건드리지 않았다.

## DoD 기준값 → 실행 후
1. 테스트 7개(direction·gemini 테스트 0개) → 14개 통과, `-t direction` 2개, `-t gemini` 5개
2. image-engine typecheck 통과 → `pnpm -r typecheck` 통과(회귀 방지, 기준값부터 통과)
3. `git check-ignore` rc=1(둘 다 무시 안 됨) → 두 경로 모두 출력
4. `spike/` 없음 → `--fake`: 일관성 16행(캐릭터 1명 × 8 × 2), 검열 30행, 46장, $0. `--fake --fake-error`: 오류 1행으로 기록하고 끝까지 진행
5. `7장 이상` 0 / `gemini-3-pro-image` 0 → 각각 1
6. UAT — 미실행. `GEMINI_API_KEY`와 `spike/inputs/` 이미지가 아직 없다

## 저장소 복구 (2026-11-05)
- 2026-11-03 15:33 무렵 `.git`이 원인 불명으로 사라져 푸시 전 커밋 6개(`9b8d5f5` `0c6e126` `6ee6b3e` `4d8329c` `134228e` `1d8761a`)를 잃었다. 작업 트리는 남아 있었다.
- 원격(`https://github.com/gyuha/muse-pen`, `main`=`7527187`)에서 `.git`만 다시 받아 붙이고 같은 내용을 다시 커밋했다: `300b204`(docs/05), `c11776e`(image-engine 전체), forge 기록 커밋. 위 슬라이스별 해시는 옛 해시다.
- 복구 후 재확인: 테스트 14개 통과, `pnpm -r typecheck` 통과, check-ignore 두 경로 출력.

## 후속 작업 후보

<!-- followup: fu-22453050be48 | source: image-consistency-censorship-spike | task: 10 | date: 2026-11-03 | status: open | taken: - -->
- 결과 반영: 실제 실행 후 사람이 `spike/RESULTS.md`의 "같은 인물" 칸과 오류 행을 판정하면, fg-ask로 그릴링해 Gemini 유지 / 한 용도 모델 재결정 / FLUX 교체를 정하고 ADR 261101-233441·docs/05에 기록하며 진 쪽 코드를 정리한다.
  Evidence: 이번 계획은 판정표 생성까지로 범위를 좁혔다(결정 3).

<!-- followup: fu-d4befa24d1b1 | source: image-consistency-censorship-spike | task: 10 | date: 2026-11-03 | status: open | taken: - -->
- 한국어 검색 품질 스파이크(Claude 검색 vs Tavily): 2026-11-03 그릴링에서 사용자 요청으로 미뤘다. "개발은 구독, 운영은 API 키" 결정과 함께 다시 그릴링한다.
  Evidence: 그릴링 결정 5에서 미룸.
