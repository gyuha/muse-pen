import { useCallback, useState } from 'react';
import { BlockNotePane } from './BlockNotePane';
import type { ImeLogEntry } from './imeLog';
import { PlatePane } from './PlatePane';

const MAX_LOG = 300;
let nextId = 1;

export function SpikePage() {
  const [log, setLog] = useState<ImeLogEntry[]>([]);

  const push = useCallback((editor: string, text: string) => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0');
    setLog((prev) => [{ id: nextId++, time, editor, text }, ...prev].slice(0, MAX_LOG));
  }, []);

  return (
    <div className="spike">
      <div>
        <h1>에디터 한국어 IME 스파이크</h1>
        <p className="hint">
          각 에디터에서 한글을 입력하며 조합 중 Enter·Backspace·클릭, "/" 메뉴 한글 입력, ghost text를 시험한다. 판정은 CHECKLIST.md에 적는다.
          입력을 1초 멈추면 가짜 ghost text가 뜨고, 조합 중에는 숨는다.
        </p>
      </div>
      <div className="spike-editors">
        <section className="spike-pane">
          <h2>BlockNote</h2>
          <BlockNotePane push={push} />
        </section>
        <section className="spike-pane">
          <h2>Plate</h2>
          <PlatePane push={push} />
        </section>
      </div>
      <section className="spike-log">
        <header>
          <h2>이벤트 로그 (최신이 위)</h2>
          <button type="button" onClick={() => setLog([])}>
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
    </div>
  );
}
