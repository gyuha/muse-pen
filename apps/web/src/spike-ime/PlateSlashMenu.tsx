import { Combobox, ComboboxItem, ComboboxPopover, ComboboxProvider, useComboboxStore } from '@ariakit/react';
import { useComboboxInput, useHTMLInputCursorState } from '@platejs/combobox/react';
import type { Point, TElement } from 'platejs';
import { PlateElement, type PlateElementProps, useEditorRef } from 'platejs/react';
import { startTransition, useEffect, useRef, useState } from 'react';

const TRIGGER = '/';

const ITEMS = ['이어쓰기', '초안', '요약', '다시쓰기', '제목', '목록'];

/**
 * Plate의 InlineCombobox(레지스트리 slash-node)와 같은 구조를 줄여 만든 "/" 메뉴 입력이다.
 * 입력은 ariakit Combobox(<input>)이고, 취소·제거 동작은 @platejs/combobox의 useComboboxInput이 맡는다.
 */
export function PlateSlashInput(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = props.element as TElement;
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorState = useHTMLInputCursorState(inputRef);
  const [value, setValue] = useState('');
  const insertPoint = useRef<Point | null>(null);

  useEffect(() => {
    const path = editor.api.findPath(element);
    if (!path) return;
    const point = editor.api.before(path);
    if (!point) return;
    const pointRef = editor.api.pointRef(point);
    insertPoint.current = pointRef.current;
    return () => {
      pointRef.unref();
    };
  }, [editor, element]);

  const { props: inputProps, removeInput } = useComboboxInput({
    cancelInputOnBlur: false,
    cursorState,
    autoFocus: true,
    ref: inputRef,
    onCancelInput: (cause) => {
      if (cause !== 'backspace') editor.tf.insertText(TRIGGER + value, { at: insertPoint.current ?? undefined });
      if (cause === 'arrowLeft' || cause === 'arrowRight') editor.tf.move({ distance: 1, reverse: cause === 'arrowLeft' });
    },
  });

  const store = useComboboxStore({ setValue: (next) => startTransition(() => setValue(next)) });
  const visible = ITEMS.filter((title) => title.toLowerCase().includes(value.toLowerCase()));

  return (
    <PlateElement {...props} as="span" className="plate-slash-input">
      <span contentEditable={false}>
        <ComboboxProvider open store={store}>
          {TRIGGER}
          <span style={{ position: 'relative', display: 'inline-block', minWidth: 8 }}>
            <span style={{ visibility: 'hidden', whiteSpace: 'pre' }} aria-hidden="true">
              {value || '​'}
            </span>
            <Combobox
              ref={inputRef}
              autoSelect
              value={value}
              style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
              {...inputProps}
            />
          </span>
          <ComboboxPopover className="plate-slash-menu" gutter={4} portal sameWidth={false}>
            {visible.length === 0 && <div className="plate-slash-item">결과 없음</div>}
            {visible.map((title) => (
              <ComboboxItem
                key={title}
                className="plate-slash-item"
                value={title}
                onClick={() => {
                  removeInput(true);
                  editor.tf.insertNodes(
                    { type: 'p', children: [{ text: `[${title}] 항목을 선택함` }] },
                    { select: false },
                  );
                }}
              >
                {title}
              </ComboboxItem>
            ))}
          </ComboboxPopover>
        </ComboboxProvider>
      </span>
      {props.children}
    </PlateElement>
  );
}
