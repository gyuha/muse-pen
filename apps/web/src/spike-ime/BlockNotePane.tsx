import { createExtension, filterSuggestionItems } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from '@blocknote/react';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { useEffect, useRef } from 'react';
import { GHOST_DELAY_MS, GHOST_TEXT } from './ghost';
import { attachImeLog, type PushLog } from './imeLog';

const ghostKey = new PluginKey<boolean>('spikeGhostText');

// 최소 구현: 입력이 멈춘 뒤 커서 옆에 widget decoration을 하나 둔다. 문서·선택이 바뀌면 바로 걷는다.
const ghostPlugin = new Plugin<boolean>({
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
  },
  view: () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
      update(view, prevState) {
        if (prevState.doc.eq(view.state.doc) && prevState.selection.eq(view.state.selection)) return;
        clearTimeout(timer);
        const { $from, empty } = view.state.selection;
        if (!empty || $from.parent.textContent.length === 0) return;
        timer = setTimeout(() => view.dispatch(view.state.tr.setMeta(ghostKey, true)), GHOST_DELAY_MS);
      },
      destroy: () => clearTimeout(timer),
    };
  },
});

const ghostExtension = createExtension({ key: 'spikeGhostText', prosemirrorPlugins: [ghostPlugin] });

const KOREAN_ITEMS = ['이어쓰기', '초안', '요약', '다시쓰기'];

export function BlockNotePane({ push }: { push: PushLog }) {
  const editor = useCreateBlockNote({ extensions: [ghostExtension] });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => attachImeLog(rootRef.current!, 'BlockNote', push), [push]);

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
    <div ref={rootRef} className="spike-editor">
      <BlockNoteView editor={editor} slashMenu={false}>
        <SuggestionMenuController triggerCharacter="/" getItems={getItems} />
      </BlockNoteView>
    </div>
  );
}
