# Follow-ups

<!-- followup: fu-846d69fd39f6 | source: dev-claude-code-text-provider | task: 17 | date: 2026-11-05 | status: open | taken: - -->
- 가입 직후 세션 확인: 초대 코드 가입(200) 직후 쿠키로 작품 생성이 401이고, 다시 로그인하면 정상이다. 가입 후 자동 로그인이 꺼진 의도된 설계인지 확인하고, 아니라면 고친다(backend, 인증).
  Evidence: 2026-11-05 UAT 스크립트에서 재현(가입 200 → POST /api/works 401 → 로그인 200 → 정상).
