export type ImeLogEntry = { id: number; time: string; editor: string; text: string };

export type PushLog = (editor: string, text: string) => void;

const MAX_LOG = 300;
let entries: ImeLogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

/**
 * 로그는 React 트리 밖의 store에 쌓는다. 이벤트가 쌓여도 에디터가 있는 컴포넌트는 다시 그려지지 않고,
 * 로그 패널만 구독해서 다시 그린다(로그 리렌더가 조합을 깨뜨렸는지 가를 수 없게 되는 것을 막는다).
 */
export const pushLog: PushLog = (editor, text) => {
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0');
  entries = [{ id: nextId++, time, editor, text }, ...entries].slice(0, MAX_LOG);
  listeners.forEach((listener) => listener());
};
export const clearLog = () => {
  entries = [];
  listeners.forEach((listener) => listener());
};
export const subscribeLog = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getLogSnapshot = () => entries;

const show = (value: string | null | undefined) => JSON.stringify(value ?? '');

/**
 * 에디터 래퍼에서 조합 관련 이벤트를 캡처 단계로 받아 로그에 남기고,
 * 조합 중에는 래퍼에 data-composing을 달아 CSS가 ghost text를 숨기게 한다(docs/06 ghost text 표시 규칙).
 * React 상태를 쓰지 않고 DOM에 직접 표시해 조합 중 리렌더가 일어나지 않게 한다.
 */
export function attachImeLog(root: HTMLElement, editor: string, push: PushLog, onCompositionStart?: () => void): () => void {
  const onComposition = (event: Event) => {
    const e = event as CompositionEvent;
    if (e.type === 'compositionstart') {
      root.dataset.composing = 'true';
      onCompositionStart?.();
    }
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

export const isComposing = (root: HTMLElement | null) => root?.dataset.composing === 'true';
