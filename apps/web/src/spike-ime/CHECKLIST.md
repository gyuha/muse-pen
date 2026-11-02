# 에디터 한국어 IME 스파이크 체크리스트

BlockNote와 Plate를 같은 조건에서 시험해 에디터 라이브러리를 정하는 양식이다. 시험은 사람이 실제 키보드로 한다. 배경과 통과 조건은 [docs/06](../../../../docs/06-editor-and-ai-ux.md)의 스파이크 시험 매트릭스를 따른다.

## 실행 방법

1. 저장소 루트에서 `pnpm install` 후 `pnpm --filter @muse-pen/web dev`를 실행한다.
2. 브라우저에서 `http://localhost:5173/spike-ime.html`을 연다(포트는 터미널 출력을 따른다).
3. 각 에디터 위 "기본 모드(플러그인 없음)" 체크박스는 기본으로 켜져 있다. 켜면 맨 라이브러리(Plate는 플러그인 없음, BlockNote는 ghost text·커스텀 "/" 항목 없음)이고, 끄면 "/" 메뉴(한글 항목)와 ghost text가 붙은 플러그인 모드로 에디터가 다시 만들어진다(입력 내용은 사라진다). 먼저 기본 모드로 시험한다.
4. 각 에디터 아래 "렌더 횟수"는 그 에디터 컴포넌트의 렌더 함수가 호출된 횟수다. 로그가 쌓여도 이 숫자가 늘지 않아야 한다. 입력 중 이 숫자가 계속 오르면 시험 페이지가 조합을 방해하는 것이므로 메모에 적는다.
5. 왼쪽 BlockNote, 오른쪽 Plate에서 같은 시험을 한다. 아래 로그 패널이 `compositionstart/update/end`, `beforeinput`, `keydown`(Enter·Backspace)을 순서대로 보여 주므로, 실패하면 로그를 메모에 옮겨 적는다.
6. 입력기는 macOS는 두벌식, Windows는 Microsoft 한글 IME를 쓴다.

## 시험 방법과 통과 조건

| 항목 | 시험 방법 | 통과 조건 |
|---|---|---|
| 조합 중 Enter | 한글 음절을 조합하는 중에 Enter | 마지막 음절이 사라지거나 중복되지 않는다 |
| 조합 중 Backspace | 조합 중에 Backspace를 반복 | 조합이 취소되지 않고 한 자모씩 지워진다 |
| 조합 중 클릭 | 조합 중에 같은 문서의 다른 위치를 마우스로 클릭 | 글자가 중복·소실되지 않는다 |
| "/" 메뉴 한글 입력 | `/` 입력 후 `초안`, `이어쓰기` 등 한글 입력 | 메뉴 필터링과 선택이 정상 동작한다 |
| ghost text | 글을 쓰다 1초 멈춰 가짜 제안이 뜬 상태에서 한글 입력 | 조합이 깨지지 않고, 조합 중에는 제안이 뜨지 않는다 |

한 칸이라도 입력이 깨지면 그 후보는 해당 환경에서 실패다. 칸에는 `통과` / `실패` / `미시험`과 메모를 적는다.

## 결정 규칙

- 한 후보만 통과 → 그 후보를 채택한다.
- 둘 다 통과 → Plate를 채택한다.
- 둘 다 실패 → Lexical을 검토한다.
- 판정은 **조합 중 Enter, 조합 중 Backspace, 조합 중 클릭, "/" 메뉴 한글 입력** 네 항목을 중심으로 한다. ghost text 칸은 참고로 쓴다(BlockNote는 직접 구현이라 시험 코드의 결함일 수 있다).
- Enter·Backspace·클릭 판정은 **기본 모드** 결과로 한다. 플러그인 모드에서만 실패하면 라이브러리 실패가 아니라 시험 코드/플러그인 설정 문제로 기록한다.
- Plate의 "/" 실패 시 이벤트 로그로 라이브러리(Slate/ariakit) 문제인지 시험 코드 문제인지 먼저 가린 뒤 판정한다. Plate의 "/" 메뉴는 공식 slash-node UI가 아니라 그 구조를 줄여 직접 쓴 `PlateSlashMenu.tsx`다.
- 이번 판정은 macOS 4행으로 한다. Windows 3행은 미시험으로 두고, 나중에 같은 저장소를 받아 이어서 채운다.

## 시험 조건

- 두 에디터 모두 입력을 1초 멈추면 고정 가짜 문자열이 ghost text로 뜬다(플러그인 모드). AI 호출은 없다. 조합 중(`compositionstart`~`compositionend`)에는 제안을 만들지 않고, 떠 있던 제안은 조합이 시작될 때 걷는다.
- Plate Copilot은 기본 `autoTriggerQuery`(블록이 공백으로 끝날 때만 동작)를 바꿔, 블록에 글자가 있고 제안이 없으면 뜨게 했고, `triggerQuery`에는 조합 중 여부 조건을 더했다. 시험을 쉽게 하려는 변경이라 기본 동작과 다르다.

## 시험 버전 기록

시험 페이지가 쓰는 패키지 버전(`apps/web/package.json`에 고정됨)이다.

| 후보 | 패키지 | 버전 |
|---|---|---|
| BlockNote | `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine` | 0.57.0 |
| Plate | `platejs` | 53.5.2 |
| Plate | `@platejs/ai`(Copilot) | 53.3.18 |
| Plate | `@platejs/slash-command`, `@platejs/combobox` | 53.0.0 |

| 환경 | 브라우저 버전 | macOS/Windows 버전 | 시험일 | 시험자 |
|---|---|---|---|---|
| macOS Chrome |  |  |  |  |
| macOS Safari |  |  |  |  |
| macOS Firefox |  |  |  |  |
| macOS Edge |  |  |  |  |
| Windows Chrome |  |  |  |  |
| Windows Firefox |  |  |  |  |
| Windows Edge |  |  |  |  |

## 결과표 (7환경 × 5항목 × 후보 2개 = 70칸)

### BlockNote

| 환경 | 조합 중 Enter | 조합 중 Backspace | 조합 중 클릭 | "/" 메뉴 한글 입력 | ghost text |
|---|---|---|---|---|---|
| macOS Chrome |  |  |  |  | (직접 구현 결함 가능) |
| macOS Safari |  |  |  |  | (직접 구현 결함 가능) |
| macOS Firefox |  |  |  |  | (직접 구현 결함 가능) |
| macOS Edge |  |  |  |  | (직접 구현 결함 가능) |
| Windows Chrome | 미시험 | 미시험 | 미시험 | 미시험 | 미시험 (직접 구현 결함 가능) |
| Windows Firefox | 미시험 | 미시험 | 미시험 | 미시험 | 미시험 (직접 구현 결함 가능) |
| Windows Edge | 미시험 | 미시험 | 미시험 | 미시험 | 미시험 (직접 구현 결함 가능) |

### Plate

| 환경 | 조합 중 Enter | 조합 중 Backspace | 조합 중 클릭 | "/" 메뉴 한글 입력 | ghost text |
|---|---|---|---|---|---|
| macOS Chrome |  |  |  | (직접 구현 결함 가능) |  |
| macOS Safari |  |  |  | (직접 구현 결함 가능) |  |
| macOS Firefox |  |  |  | (직접 구현 결함 가능) |  |
| macOS Edge |  |  |  | (직접 구현 결함 가능) |  |
| Windows Chrome | 미시험 | 미시험 | 미시험 | 미시험 (직접 구현 결함 가능) | 미시험 |
| Windows Firefox | 미시험 | 미시험 | 미시험 | 미시험 (직접 구현 결함 가능) | 미시험 |
| Windows Edge | 미시험 | 미시험 | 미시험 | 미시험 (직접 구현 결함 가능) | 미시험 |

## 메모

실패한 칸의 이벤트 로그와 재현 순서를 여기에 적는다.
