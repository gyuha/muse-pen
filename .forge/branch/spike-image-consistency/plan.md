<!-- forge-slug: image-consistency-censorship-spike -->
<!-- task: 10 -->
<!-- tdd: off -->
<!-- priority: high -->
# 이미지 일관성·검열 오탐 스파이크 — Gemini 어댑터와 시험 장치, 판정표 생성까지

## 목표 / 하지 않을 것
- 목표: `docs/08` 1단계의 이미지 스파이크를 실행할 수 있게 만든다. image-engine 인터페이스 뒤에 실제 Gemini 어댑터를 두고, 엔진에 변형 지시(`direction`)를 추가하고, 직접 준비한 대표 이미지·화풍 레퍼런스로 변형과 검열 시험 이미지를 생성해 사람이 판정할 판정표(`RESULTS.md`)와 갤러리를 만든다.
- 하지 않을 것:
  - 판정 기록과 결정 반영(Gemini 유지, 한 용도의 모델 교체, FLUX 교체, docs/ADR 갱신, 진 쪽 어댑터 삭제). 판정 결과에 따라 내용이 달라지므로 후속 작업으로 남긴다.
  - 한국어 검색 품질 스파이크. 사용자 요청으로 미뤘다(2026-11-03).
  - 운영용 오류 처리(재시도, 세밀한 오류 매핑, 속도 제한 대응), api 작업 큐 연결, frontend 화면.
  - 대표 이미지 후보 생성과 승인 흐름. 이번에는 사용자가 직접 준비한 이미지를 대표 이미지로 쓴다.
  - 차단되는 것이 정상인 묘사(미성년자 성적 묘사 등)의 시험.
  - 입력 이미지와 생성 이미지의 커밋.

## 근거 문서
- 용어: `.forge/CONTEXT.md`의 대표 이미지, 화풍 프리셋, 정형 필드, 캐릭터.
- 관련 ADR: `.forge/adr/261101-233441-reference-conditioned-images-gemini.md`(레퍼런스 조건부 생성, Gemini, 미통과 시 FLUX).
- 이번 그릴링에서 정한 것(2026-11-03):
  - **비용 방식:** 개발은 구독제, 운영은 API 키로 한다. 다만 Gemini 이미지 모델에는 무료 등급도 구독 경로도 없으므로, 이 스파이크만 종량제 `GEMINI_API_KEY`를 예외로 쓴다. 콘솔 월 지출 한도는 $10이다.
  - **실제 모델 ID와 단가(aistudio.google.com/docs/pricing, 2026-11-03 확인):**
    - 초안: `gemini-nano-banana-2.1`, 1K 해상도 장당 $0.0336.
    - 최종: `gemini-3-pro-image`, 1K·2K 해상도 장당 $0.134.
    - 엔진의 논리 이름 `nano-banana-2.1`·`nano-banana-pro`(`packages/image-engine/src/index.ts:4-5`)는 어댑터가 위 실제 ID로 바꾸고, 결과에는 실제 ID를 기록한다.
  - **시험 규모:**
    - 일관성: 캐릭터마다 고정된 변형 지시 8개를 두 모델에 각각 보낸다. 지시는 정면 미소, 옆모습 분노, 우는 얼굴 클로즈업, 검을 든 전투 자세, 달리는 전신, 앉은 자세, 3/4 뒷모습, 다른 의상이다.
    - 검열 오탐: 정상 묘사 프롬프트 15개(교복 10대 일상 5, 검술·격투 5, 부상·출혈이 조금 있는 전투 5)를 두 모델에 각각 보낸다.
    - 예상 비용은 캐릭터 3명 기준 약 $4~5다.
  - **통과 기준(판정표에 미리 박아 둔다):**
    - 일관성: 모델별로, 모든 캐릭터에서 변형 8장 중 7장 이상이 "같은 인물"이면 통과다. 판정값은 같은 인물 / 애매 / 다른 인물이고, 애매는 통과로 세지 않는다.
    - 검열: 모델별로 15개 중 차단이 1개 이하이면 통과다.
    - 해석: 두 모델 모두 통과하면 Gemini를 유지한다. 한 모델만 실패하면 그 용도(초안 또는 최종)의 모델만 다시 정한다. 두 모델 모두 실패하면 FLUX로 교체한다.
- 완료 정의(DoD):
  1. `pnpm --filter @muse-pen/image-engine test`가 통과하고, `direction` 조립 테스트와 Gemini 어댑터 매핑 테스트(SDK 응답 → 이미지·실제 모델 ID·사용량·비용, 안전 차단 → 전용 오류)를 포함한다. 확인: `pnpm --filter @muse-pen/image-engine exec vitest run -t direction`와 `… -t gemini`가 각각 1개 이상 실행·통과한다. 작성 시점 상태: 해당 테스트가 없다(전방 확인).
  2. `pnpm --filter @muse-pen/image-engine typecheck`가 통과하고, `pnpm -r typecheck`도 깨지지 않는다. 작성 시점 상태: image-engine typecheck는 통과한다(회귀 방지용이라 미리 통과하는 것이 정상).
  3. `git check-ignore packages/image-engine/spike/out/x.png packages/image-engine/spike/inputs/a.png`가 두 경로를 모두 출력한다. 작성 시점 상태: 둘 다 무시되지 않는다(rc=1, 측정).
  4. 가짜 실행 `pnpm --filter @muse-pen/image-engine spike --fake`가 네트워크와 키 없이 성공한다. 커밋된 `spike/fixtures/`의 캐릭터 정의를 입력으로 쓰고, `spike/out/gallery.html`과 `spike/out/RESULTS.fake.md`를 만든다. `RESULTS.fake.md`에는 (캐릭터 수 × 8 × 2모델)개의 일관성 행과 30개의 검열 행(15 × 2모델)이 들어 있다. 행 개수는 생성된 파일을 세어 확인한다. 작성 시점 상태: `spike/` 디렉터리가 없다.
  5. `docs/05-image-engine.md`에 통과 기준과 실제 모델 ID·단가(확인일 포함)가 들어간다. 확인: `grep -c "7장 이상" docs/05-image-engine.md` ≥1, `grep -c "gemini-3-pro-image" docs/05-image-engine.md` ≥1. 작성 시점 상태: 둘 다 0(측정).
  6. UAT(사람 확인, 실제 API 1회 실행):
     - 사용자가 `spike/inputs/`에 이미지와 `characters.json`을, 루트 `.env`에 `GEMINI_API_KEY`를 넣고 `pnpm --filter @muse-pen/image-engine spike`를 실행한다.
     - 실행 결과 `spike/RESULTS.md`가 생긴다. 검열 결과(차단 여부와 사유), 이미지마다의 실제 모델 ID, 장수, 추정 총비용은 자동으로 채워지고, "같은 인물" 칸만 비어 있다.
     - `gallery.html`에서 대표 이미지와 변형을 나란히 볼 수 있다.
     - 추정 총비용이 $10 이하다.

## 작업 조각
- [ ] S1. 엔진에 변형 지시 추가 — `GenerateImageRequest`에 선택 필드 `direction?: string`을 두고, `buildImagePrompt` 결과 뒤에 별도 줄로 붙인다. `direction`이 없을 때의 프롬프트는 기존과 바이트 단위로 같다. — 완료 기준: `direction` 있음·없음 두 경우의 단위 테스트가 통과하고, 기존 7개 테스트도 그대로 통과한다.
- [ ] S2. Gemini 어댑터 — `packages/image-engine/src/providers/gemini.ts`에 `ImageProvider` 구현을 둔다.
  - Google 공식 JS SDK(실행 시점에 패키지 이름과 버전을 확인하고 정확한 버전으로 고정)를 쓴다.
  - 논리 모델 이름을 실제 ID로 바꾸고, 대표 이미지와 화풍 레퍼런스를 참조 입력으로 보낸다.
  - 응답을 이미지 데이터, 실제 모델 ID, `{unit:'images'}` 사용량, 단가표 기반 추정 비용으로 바꾼다.
  - 안전 차단은 사유를 담은 `ImageSafetyBlockedError`로 던진다.
  - 재시도는 넣지 않는다.
  - 완료 기준: SDK 클라이언트를 가짜로 주입한 단위 테스트로 정상 응답 매핑과 안전 차단 매핑이 통과한다(실제 네트워크 호출 없음).
- [ ] S3. 시험 장치 — `packages/image-engine/spike/`에 다음을 둔다.
  - `run.ts`: 실행 스크립트. 엔진의 `generateImage`를 거쳐 호출한다.
  - `inputs/`(gitignore), `out/`(gitignore), `characters.example.json`.
  - `fixtures/`: 가짜 실행용 작은 이미지와 캐릭터 정의, 커밋한다.
  - `spike/.gitignore`.
  - `package.json`의 `spike` 스크립트: `node --env-file`로 루트 `.env`를 읽는다. ts 실행기는 저장소에서 쓰는 `tsx`를 쓴다.
  - 변형 지시 8개와 검열 프롬프트 15개는 스크립트에 고정한다.
  - `--fake`면 `FakeImageProvider`를 쓰고 결과를 `out/RESULTS.fake.md`에 쓴다. 실제 실행이면 `spike/RESULTS.md`에 쓴다.
  - 판정표에는 통과 기준, 사람이 채울 판정 칸, 자동으로 채운 검열 결과·모델 ID·비용 합계를 넣는다.
  - `gallery.html`은 캐릭터별로 대표 이미지와 두 모델의 변형을 나란히 보여 준다.
  - 실제 실행인데 키나 입력이 없으면 API를 호출하기 전에 무엇이 없는지 알리고 멈춘다.
  - 완료 기준: DoD 3·4 통과. (depends: S1, S2)
- [ ] S4. 문서 갱신 — `docs/05-image-engine.md`의 공급자 구성 표를 실제 모델 ID·단가(2026-11-03 확인)로 고치고, "빌드 전 검증" 절에 통과 기준과 결과 해석 규칙을 적는다. 시험 실행 방법은 `spike/` 안의 README 한 단락으로 둔다. — 완료 기준: DoD 5 통과.
