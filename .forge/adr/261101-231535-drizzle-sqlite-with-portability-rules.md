---
author: gyuha
decided: 2026-11-01 23:15
---
# DB 접근층은 Drizzle로 하고, SQLite에서 DBMS로 옮길 수 있게 이식성 규칙을 지킨다

MVP는 SQLite로 시작하고 나중에 PostgreSQL 등 DBMS로 옮긴다. 이전 경로만 보면 provider만 바꾸면 되는 Prisma가 더 쉽지만, 생성 단계와 별도 엔진 비용을 매일 치르는 반면 이전은 한 번뿐이라 Drizzle을 택했다. 대가로 이전 때 스키마 정의(sqliteTable → pgTable)를 다시 써야 한다. 이전 비용을 줄이기 위해 다음 규칙을 지킨다: DB 접근은 api의 저장소 계층으로만 한다 · SQLite 전용 기능(FTS5, JSON1 함수 쿼리 등)을 쓰지 않는다 · ID는 자동 증가 정수 대신 문자열 ULID/UUID를 쓴다 · 시간 값은 한 형식으로 통일한다.
