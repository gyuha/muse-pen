import { CopilotPlugin } from '@platejs/ai/react';
import { SlashInputPlugin, SlashPlugin } from '@platejs/slash-command/react';
import { Plate, PlateContent, useElement, usePlateEditor, usePluginOption } from 'platejs/react';
import { memo, useEffect, useRef, useState } from 'react';
import { GHOST_DELAY_MS, GHOST_TEXT } from './ghost';
import { attachImeLog, isComposing, pushLog } from './imeLog';
import { PlateSlashInput } from './PlateSlashMenu';
import { useRenderCount } from './useRenderCount';

function PlateGhostText() {
  const { id } = useElement<{ id?: string; type: string; children: [] }>() as { id?: string };
  const isSuggested = usePluginOption(CopilotPlugin, 'isSuggested', id ?? '');
  const text = usePluginOption(CopilotPlugin, 'suggestionText');
  if (!id || !isSuggested || !text) return null;
  return (
    <span className="ghost-text" contentEditable={false}>
      {text}
    </span>
  );
}

function PlateEditorView({ basic }: { basic: boolean }) {
  const renderCount = useRenderCount();
  const rootRef = useRef<HTMLDivElement>(null);
  const editor = usePlateEditor({
    // 기본 모드는 플러그인 없는 맨 Plate다.
    plugins: basic
      ? []
      : [
          SlashPlugin,
          SlashInputPlugin.withComponent(PlateSlashInput),
          CopilotPlugin.configure(({ api }) => ({
            options: {
              debounceDelay: GHOST_DELAY_MS,
              renderGhostText: PlateGhostText,
              getPrompt: () => 'fixed',
              // 조합 중에는 제안을 만들지 않는다. 기본 조건(입력 끝, 선택 없음)에 더해 글자가 있으면 띄운다(시험을 쉽게 하려는 변경).
              autoTriggerQuery: ({ editor }) =>
                !isComposing(rootRef.current) &&
                !editor.getOptions(CopilotPlugin).suggestionText &&
                !editor.api.isEmpty(editor.selection, { block: true }),
              // debounce로 미뤄진 호출이 조합 중에 실행되는 것도 막는다.
              triggerQuery: ({ editor }) => !isComposing(rootRef.current) && !editor.api.isExpanded() && editor.api.isAt({ end: true }),
              completeOptions: {
                // 네트워크 없이 고정 문자열을 돌려준다.
                fetch: async () => new Response(JSON.stringify({ text: GHOST_TEXT })),
                onFinish: (_, completion) => {
                  if (!isComposing(rootRef.current)) api.copilot.setBlockSuggestion({ text: completion });
                },
              },
            },
          })),
        ],
    value: [{ type: 'p', children: [{ text: '' }] }],
  });

  useEffect(
    () =>
      attachImeLog(rootRef.current!, 'Plate', pushLog, () => {
        if (basic) return;
        // 조합이 시작되면 떠 있던 제안을 걷고 진행 중인 요청도 멈춘다.
        const { copilot } = editor.getApi(CopilotPlugin);
        copilot.stop();
        copilot.reject();
      }),
    [basic, editor],
  );

  return (
    <>
      <div ref={rootRef} className="spike-editor">
        <Plate editor={editor}>
          <PlateContent className="plate-editor" placeholder={basic ? '여기에 입력' : '여기에 입력 (/ 로 메뉴)'} />
        </Plate>
      </div>
      {renderCount}
    </>
  );
}

export const PlatePane = memo(function PlatePane() {
  const [basic, setBasic] = useState(true);
  return (
    <section className="spike-pane">
      <header>
        <h2>Plate</h2>
        <label>
          <input type="checkbox" checked={basic} onChange={(e) => setBasic(e.target.checked)} />
          기본 모드(플러그인 없음)
        </label>
      </header>
      <PlateEditorView key={String(basic)} basic={basic} />
    </section>
  );
});
