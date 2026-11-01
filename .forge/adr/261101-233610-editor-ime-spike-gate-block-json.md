---
author: gyuha
decided: 2026-11-01 23:36
---
# 에디터 라이브러리는 한국어 IME 스파이크로 정하고, 저장 원본은 라이브러리 블록 JSON으로 한다

에디터는 BlockNote와 Plate를 하루짜리 한국어 IME 스파이크(macOS·Windows × Chrome·Safari·Firefox·Edge, 두벌식·MS 한글 IME; 조합 중 Enter·Backspace·클릭, "/" 메뉴 한글 입력, 커서 옆 ghost text)로 시험해 고른다. 하나만 통과하면 그것을, 둘 다 통과하면 Plate를, 둘 다 실패하면 Lexical을 검토한다. 한국어 소설 집필에서 가장 잦은 Enter에 마지막 음절이 사라지는 버그가 BlockNote/Tiptap 계열에 열려 있고(BlockNote #1679, Tiptap #4108) 최신 버전에서 재현되는지 문서로는 알 수 없어서, 문서 비교가 아닌 실측을 관문으로 삼았다. 둘 다 통과할 때 Plate를 택하는 이유는 선택 영역 AI·"/" 생성·ghost text·수락/거절 비교가 모두 MIT로 제공되는 반면, BlockNote의 AI 패키지는 GPL-3.0 또는 유료(월 $195)이기 때문이다. 저장은 라이브러리 고유 블록 JSON을 원본으로 하고, 저장 때마다 일반 텍스트와 Markdown을 파생 저장해 AI 입력·스냅샷에 쓴다. Markdown 원본은 대기 중인 AI 제안과 블록 메타데이터를 담지 못해 택하지 않았다. ghost text는 IME 조합 중에는 숨기도록 구현하고, 한국어 웹폰트는 Pretendard 정적 빌드를 쓴다.
