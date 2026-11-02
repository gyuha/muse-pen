import { createExtension, filterSuggestionItems } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from '@blocknote/react';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { GHOST_DELAY_MS, GHOST_TEXT } from './ghost';
import { attachImeLog, pushLog } from './imeLog';
import { useRenderCount } from './useRenderCount';

// 최소 구현: 입력이 멈춘 뒤 커서 옆에 widget decoration을 하나 둔다. 문서·선택이 바뀌면 바로 걷는다.
// 조합 중에는 제안을 만들지 않고(compositionstart에 타이머·decoration 제거), 조합이 끝나면 다시 센다.
function createGhostExtension() {
  const ghostKey = new PluginKey<boolean>('spikeGhostText');
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (view: import('prosemirror-view').EditorView) => {
    clearTimeout(timer);
    const { $from, empty } = view.state.selection;
    if (!empty || $from.parent.textContent.length === 0) return;
    timer = setTimeout(() => {
      if (!view.composing) view.dispatch(view.state.tr.setMeta(ghostKey, true));
    }, GHOST_DELAY_MS);
  };

  const plugin = new Plugin<boolean>({
    key: ghostKey,
    state: {
      init: () => false,
      apply(tr, shown) {
        const meta = tr.getMeta(ghostKey) as boolean | undefined;
        if (meta !== undefined) return meta;
        return tr.docChanged || tr.selectionSet ? false : shown;
      },
    },
    props: {
      decorations(state) {
        if (!ghostKey.getState(state)) return DecorationSet.empty;
        const { selection } = state;
        if (!selection.empty) return DecorationSet.empty;
        const widget = Decoration.widget(
          selection.from,
          () => {
            const span = document.createElement('span');
            span.className = 'ghost-text';
            span.contentEditable = 'false';
            span.textContent = GHOST_TEXT;
            return span;
          },
          { side: 1, key: 'spike-ghost' },
        );
        return DecorationSet.create(state.doc, [widget]);
      },
      handleDOMEvents: {
        compositionstart(view) {
          clearTimeout(timer);
          if (ghostKey.getState(view.state)) view.dispatch(view.state.tr.setMeta(ghostKey, false));
          return false;
        },
        compositionend(view) {
          schedule(view);
          return false;
        },
      },
    },
    view: () => ({
      update(view, prevState) {
        if (prevState.doc.eq(view.state.doc) && prevState.selection.eq(view.state.selection)) return;
        schedule(view);
      },
      destroy: () => clearTimeout(timer),
    }),
  });

  return createExtension({ key: 'spikeGhostText', prosemirrorPlugins: [plugin] });
}

const KOREAN_ITEMS = ['이어쓰기', '초안', '요약', '다시쓰기'];

function BlockNoteEditorView({ basic }: { basic: boolean }) {
  const renderCount = useRenderCount();
  const extensions = useMemo(() => (basic ? [] : [createGhostExtension()]), [basic]);
  const editor = useCreateBlockNote({ extensions });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => attachImeLog(rootRef.current!, 'BlockNote', pushLog), []);

  const getItems = async (query: string) =>
    filterSuggestionItems(
      [
        ...getDefaultReactSlashMenuItems(editor),
        ...KOREAN_ITEMS.map((title) => ({
          title,
          group: '한글 시험',
          subtext: `${title} 항목 (필터링 시험용)`,
          onItemClick: () => {
            editor.insertBlocks(
              [{ type: 'paragraph', content: `[${title}] 항목을 선택함` }],
              editor.getTextCursorPosition().block,
              'after',
            );
          },
        })),
      ],
      query,
    );

  return (
    <>
      <div ref={rootRef} className="spike-editor">
        {basic ? (
          <BlockNoteView editor={editor} />
        ) : (
          <BlockNoteView editor={editor} slashMenu={false}>
            <SuggestionMenuController triggerCharacter="/" getItems={getItems} />
          </BlockNoteView>
        )}
      </div>
      {renderCount}
    </>
  );
}

export const BlockNotePane = memo(function BlockNotePane() {
  const [basic, setBasic] = useState(true);
  return (
    <section className="spike-pane">
      <header>
        <h2>BlockNote</h2>
        <label>
          <input type="checkbox" checked={basic} onChange={(e) => setBasic(e.target.checked)} />
          기본 모드(플러그인 없음)
        </label>
      </header>
      <BlockNoteEditorView key={String(basic)} basic={basic} />
    </section>
  );
});
