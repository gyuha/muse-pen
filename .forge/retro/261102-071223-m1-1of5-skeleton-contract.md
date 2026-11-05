<!-- auto-retro: fg-loop -->
# 2026-11-02 — M1 1/5 모노레포 골격과 공용 계약

## Plan vs actual
- What went as planned: 골격·의존성 일괄 설치·shared 스키마·커밋 모두 DoD 충족.
- Divergences: 화풍 프리셋 레퍼런스 1~3장을 작품 생성 시점부터 필수로 둔 스키마는 이미지가 작품에 속하는 데이터 모델과 순서가 충돌한다. TypeScript 6의 rootDir 요구, 라이브러리 exports가 src를 직접 가리키는 선택이 뒤 작업(api 실행 방식)에 영향.

## Learnings
- Do differently next time: 문서의 "N~M장" 같은 수량 규칙을 스키마로 옮길 때는 그 값이 언제 채워질 수 있는지(생성 시점 vs 사용 시점)를 플랜에 명시해야 한다. 역할 에이전트에 위임할 때는 zsh 글롭 같은 환경 차이로 workspace 의존성 추가가 실패할 수 있으니 `'pkg@workspace:*'` 인용을 프롬프트에 넣어 두면 재시도가 준다.

## Doc updates
- 검토되지 않음(자동 회고) — CONTEXT.md·ADR 승격 없음
