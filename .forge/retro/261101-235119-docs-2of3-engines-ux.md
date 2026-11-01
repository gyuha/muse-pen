<!-- auto-retro: fg-loop -->
# 2026-11-01 — 제작 문서 2/3(04 스토리 엔진·05 이미지 엔진·06 에디터·07 자료 조사) 작성

## Plan vs actual
- What went as planned: 슬라이스 4개 완료, C2 담당 누락 13 → 0, C7·C8 담당 지적 0, C9 원본 불변.
- Divergences: 플랜의 C8 baseline 값(2)이 실제(1)와 달랐다 — 검사 출력이 한 줄로 묶여 `grep -c`가 줄 수를 세기 때문. 조사 근거(가격·이슈 번호)는 플랜에 요약해 넣어 둔 덕에 문서에 "조사 기준·일부 미검증" 표시와 함께 옮길 수 있었다.

## Learnings
- Do differently next time: 한 줄로 결과를 묶어 출력하는 검사 스크립트에 대해 DoD를 쓸 때는 `grep -c`(줄 수) 대신 `grep -o … | wc -l`(일치 수)를 써야 기대값이 의미를 가진다. 서브에이전트나 다음 세션이 대화 맥락 없이 문서를 쓰게 될 때를 대비해, 결정 원본에 없는 조사 근거는 플랜의 Source of truth에 요약해 두는 방식이 유효했다.

## Doc updates
- 검토되지 않음(자동 회고) — CONTEXT.md·ADR 승격 없음
