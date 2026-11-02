import { useSyncExternalStore } from 'react';
import { BlockNotePane } from './BlockNotePane';
import { clearLog, getLogSnapshot, subscribeLog } from './imeLog';
import { PlatePane } from './PlatePane';

function LogPanel() {
  const log = useSyncExternalStore(subscribeLog, getLogSnapshot);
  return (
    <section className="spike-log">
      <header>
        <h2>이벤트 로그 (최신이 위)</h2>
        <button type="button" onClick={clearLog}>
          지우기
        </button>
      </header>
      <ol>
        {log.map((entry) => (
          <li key={entry.id}>
            {entry.time} <strong className={`tag-${entry.editor.toLowerCase()}`}>[{entry.editor}]</strong> {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SpikePage() {
  return (
    <div className="spike">
      <div>
        <h1>에디터 한국어 IME 스파이크</h1>
        <p className="hint">
          각 에디터에서 한글을 입력하며 조합 중 Enter·Backspace·클릭, "/" 메뉴 한글 입력, ghost text를 시험한다. 판정은 CHECKLIST.md에 적는다.
          먼저 "기본 모드(플러그인 없음)"로 맨 라이브러리를 시험하고, 끄면 "/" 메뉴·ghost text가 붙는다. 입력을 1초 멈추면 가짜 ghost text가 뜨고, 조합 중에는 뜨지 않는다.
        </p>
      </div>
      <div className="spike-editors">
        <BlockNotePane />
        <PlatePane />
      </div>
      <LogPanel />
    </div>
  );
}
