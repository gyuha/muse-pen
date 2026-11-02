import { useEffect, useRef } from 'react';

/**
 * 이 컴포넌트의 렌더 함수가 호출된 횟수를 화면 구석에 표시한다.
 * 숫자는 effect에서 DOM에 직접 쓰므로 카운터 자체가 리렌더를 일으키지 않는다.
 */
export function useRenderCount() {
  const count = useRef(0);
  const el = useRef<HTMLSpanElement>(null);
  count.current += 1;
  useEffect(() => {
    if (el.current) el.current.textContent = String(count.current);
  });
  return <span className="render-count">렌더 횟수: <span ref={el} /></span>;
}
