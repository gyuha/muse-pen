import { CopilotPlugin } from '@platejs/ai/react';
import { SlashInputPlugin, SlashPlugin } from '@platejs/slash-command/react';
import { Plate, PlateContent, useElement, usePlateEditor, usePluginOption } from 'platejs/react';
import { useEffect, useRef } from 'react';
import { GHOST_DELAY_MS, GHOST_TEXT } from './ghost';
import { attachImeLog, type PushLog } from './imeLog';
import { PlateSlashInput } from './PlateSlashMenu';

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

export function PlatePane({ push }: { push: PushLog }) {
  const editor = usePlateEditor({
    plugins: [
      SlashPlugin,
      SlashInputPlugin.withComponent(PlateSlashInput),
      CopilotPlugin.configure(({ api }) => ({
        options: {
          debounceDelay: GHOST_DELAY_MS,
          renderGhostText: PlateGhostText,
          getPrompt: () => 'fixed',
          // 입력 끝에서만 뜨는 기본 조건에 더해, 공백 끝이 아니어도 글자가 있으면 띄운다(시험을 쉽게 하려는 것).
          autoTriggerQuery: ({ editor }) =>
            !editor.getOptions(CopilotPlugin).suggestionText && !editor.api.isEmpty(editor.selection, { block: true }),
          completeOptions: {
            // 네트워크 없이 고정 문자열을 돌려준다.
            fetch: async () => new Response(JSON.stringify({ text: GHOST_TEXT })),
            onFinish: (_, completion) => api.copilot.setBlockSuggestion({ text: completion }),
          },
        },
      })),
    ],
    value: [{ type: 'p', children: [{ text: '' }] }],
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => attachImeLog(rootRef.current!, 'Plate', push), [push]);

  return (
    <div ref={rootRef} className="spike-editor">
      <Plate editor={editor}>
        <PlateContent className="plate-editor" placeholder="여기에 입력 (/ 로 메뉴)" />
      </Plate>
    </div>
  );
}
