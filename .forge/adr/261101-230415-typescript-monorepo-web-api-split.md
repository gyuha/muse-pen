---
author: gyuha
decided: 2026-11-01 23:04
---
# TypeScript 모노레포에서 apps/web과 apps/api를 분리한다

pnpm workspace 모노레포에 apps/web·apps/api와 packages/shared·story-engine·image-engine을 두고 모두 TypeScript로 쓴다. packages/shared의 API 타입·스키마를 모든 패키지가 같은 언어로 직접 공유하기 위해서다. Python 백엔드는 이미지 모델을 직접 돌릴 때만 이점이 있는데, MVP는 호스팅된 이미지 API를 호출하므로 택하지 않았다. Next.js 풀스택 단일 앱은 장시간 AI 작업과 큐 처리를 라우트 핸들러에 넣기 불편하고, 팀의 역할·폴더 분리와 맞지 않아 택하지 않았다.
