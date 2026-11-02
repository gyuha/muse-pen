export type ImeLogEntry = { id: number; time: string; editor: string; text: string };

export type PushLog = (editor: string, text: string) => void;

const show = (value: string | null | undefined) => JSON.stringify(value ?? '');

/**
 * 에디터 래퍼에서 조합 관련 이벤트를 캡처 단계로 받아 로그에 남기고,
 * 조합 중에는 래퍼에 data-composing을 달아 CSS가 ghost text를 숨기게 한다(docs/06 ghost text 표시 규칙).
 * React 상태를 쓰지 않고 DOM에 직접 표시해 조합 중 리렌더가 일어나지 않게 한다.
 */
export function attachImeLog(root: HTMLElement, editor: string, push: PushLog): () => void {
  const onComposition = (event: Event) => {
    const e = event as CompositionEvent;
    if (e.type === 'compositionstart') root.dataset.composing = 'true';
    if (e.type === 'compositionend') delete root.dataset.composing;
    push(editor, `${e.type} data=${show(e.data)}`);
  };
  const onBeforeInput = (event: Event) => {
    const e = event as InputEvent;
    push(editor, `beforeinput ${e.inputType} data=${show(e.data)} isComposing=${e.isComposing}`);
  };
  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.key !== 'Enter' && e.key !== 'Backspace') return;
    push(editor, `keydown ${e.key} isComposing=${e.isComposing} keyCode=${e.keyCode}`);
  };

  const types = ['compositionstart', 'compositionupdate', 'compositionend'];
  types.forEach((type) => root.addEventListener(type, onComposition, true));
  root.addEventListener('beforeinput', onBeforeInput, true);
  root.addEventListener('keydown', onKeyDown, true);
  return () => {
    types.forEach((type) => root.removeEventListener(type, onComposition, true));
    root.removeEventListener('beforeinput', onBeforeInput, true);
    root.removeEventListener('keydown', onKeyDown, true);
  };
}
