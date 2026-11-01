---
author: gyuha
decided: 2026-11-01 23:21
---
# MVP는 단일 VPS의 Docker Compose로 배포하고, api는 단일 인스턴스로만 실행한다

Caddy(HTTPS·정적 web·/api 프록시)와 api 컨테이너를 단일 VPS의 Docker Compose로 띄우고, SQLite 파일과 이미지 디렉터리는 호스트 볼륨에 둔다. SQLite, 로컬 디스크 이미지 저장소, api 프로세스 안의 작업 워커가 모두 영속 디스크를 가진 상시 실행 서버 하나를 전제하므로, api를 여러 인스턴스로 늘리는 것은 DBMS·S3·외부 큐로 옮기기 전까지 불가능하다(이 제약은 코드에 드러나지 않는다). 원고 전체가 SQLite 파일 하나에 있으므로 Litestream으로 SQLite를 S3 호환 스토리지에 지속 복제하고 이미지 디렉터리는 주기적으로 동기화하는 백업을 MVP에 포함한다. 휘발성 디스크의 서버리스형 PaaS는 이 전제와 충돌해 택하지 않았다.
