import type { AiFeature } from '@muse-pen/shared';
import { assembleContext } from './context';
import { findConflictWarnings, type ConflictWarning } from './conflict';
import { SYSTEM_PROMPTS, section } from './prompts';
import {
  DEFAULT_MODELS,
  tokenUsageReport,
  type ModelIds,
  type TextProvider,
  type TextRequest,
  type TextTask,
  type UsageReport,
  type UsageReporter,
} from './provider';
import type { ContextInput } from './types';

export interface EngineDeps {
  provider: TextProvider;
  models?: ModelIds;
  onUsage?: UsageReporter;
}

export interface AiSuggestion {
  task: TextTask;
  text: string;
  warnings: ConflictWarning[];
  usage: UsageReport;
}

// tokens를 끝까지 소비하면 result가 AI 제안(+자동 경고)으로 확정된다.
export interface SuggestionStream {
  tokens: AsyncIterable<string>;
  result: Promise<AiSuggestion>;
}

export function buildRequest(
  deps: EngineDeps,
  task: TextTask,
  feature: AiFeature,
  prompt: string,
): TextRequest {
  const models = deps.models ?? DEFAULT_MODELS;
  return {
    task,
    feature,
    model: task === 'ghost' ? models.light : models.main,
    system: SYSTEM_PROMPTS[task],
    prompt,
  };
}

function streamSuggestion(deps: EngineDeps, task: TextTask, input: ContextInput, request: string): SuggestionStream {
  const req = buildRequest(deps, task, 'text_generation', `${assembleContext(input).text}\n\n${request}`);
  let settle!: { resolve: (s: AiSuggestion) => void; reject: (e: unknown) => void };
  const result = new Promise<AiSuggestion>((resolve, reject) => {
    settle = { resolve, reject };
  });
  result.catch(() => {}); // 호출자가 result를 안 기다려도 미처리 거부로 새지 않게 한다.

  async function* tokens(): AsyncGenerator<string> {
    let text = '';
    let report: UsageReport | undefined;
    try {
      for await (const event of deps.provider.stream(req)) {
        if (event.type === 'token') {
          text += event.text;
          yield event.text;
        } else {
          report = tokenUsageReport(req.feature, event.usage);
        }
      }
      if (!report) throw new Error('공급자가 사용량을 보고하지 않았다');
      deps.onUsage?.(report);
      settle.resolve({ task, text, warnings: findConflictWarnings(text, input.settings), usage: report });
    } catch (error) {
      settle.reject(error);
      throw error;
    } finally {
      settle.reject(new Error('스트림이 끝까지 소비되지 않았다')); // 이미 확정됐으면 무시된다.
    }
  }
  return { tokens: tokens(), result };
}

export function continueWriting(deps: EngineDeps, input: ContextInput, textBefore: string): SuggestionStream {
  return streamSuggestion(deps, 'continue', input, section('요청: 이어쓰기', `다음 본문 바로 뒤에 이어질 블록을 쓴다.\n\n${textBefore}`));
}

export function rewriteSelection(deps: EngineDeps, input: ContextInput, selection: string): SuggestionStream {
  return streamSuggestion(deps, 'rewrite', input, section('요청: 다시쓰기', `선택한 문장을 의미를 유지하며 다시 쓴다.\n\n${selection}`));
}

export function polishStyle(deps: EngineDeps, input: ContextInput, selection: string): SuggestionStream {
  const { tone, pointOfView } = input.concept;
  const pov = pointOfView === 'first_person' ? '1인칭' : '3인칭';
  return streamSuggestion(
    deps,
    'polish',
    input,
    section('요청: 문체 다듬기', `톤은 "${tone}", 서술 시점은 ${pov}에 맞게 선택한 문장의 문체만 다듬는다. 내용은 바꾸지 않는다.\n\n${selection}`),
  );
}

export function adjustLength(
  deps: EngineDeps,
  input: ContextInput,
  selection: string,
  direction: 'expand' | 'shrink',
): SuggestionStream {
  const verb = direction === 'expand' ? '늘린다. 묘사와 감정을 보태되 사건은 추가하지 않는다' : '줄인다. 핵심만 남긴다';
  return streamSuggestion(deps, direction, input, section(`요청: ${direction === 'expand' ? '늘리기' : '줄이기'}`, `선택한 문장을 ${verb}.\n\n${selection}`));
}

// 회차 초안은 플롯 메모 기반이라 input.currentEpisode.plotMemo가 컨텍스트에 실린다.
export function draftEpisode(deps: EngineDeps, input: ContextInput): SuggestionStream {
  return streamSuggestion(deps, 'draft', input, section('요청: 회차 초안', '이번 회차의 플롯 메모를 따라 회차 초안을 쓴다.'));
}

// 한 문장 이내로 자른다(문장 부호 뒤의 닫는 따옴표·괄호는 문장에 포함).
export function firstSentence(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  const match = /^[\s\S]*?[.!?。！？…]+["'”’」』)\]]*/.exec(line);
  return (match ? match[0] : line).trim();
}

export interface GhostText {
  text: string;
  usage: UsageReport;
}

// ghost text: 하위 모델, 축약 컨텍스트(회차 이력·자료 제외), 한 문장 이내.
export async function ghostText(deps: EngineDeps, input: ContextInput, textBefore: string): Promise<GhostText> {
  const compact: ContextInput = { ...input, episodes: [], resources: [], pinnedResourceIds: [] };
  const req = buildRequest(
    deps,
    'ghost',
    'ghost_text',
    `${assembleContext(compact).text}\n\n${section('요청: 한 문장 이어쓰기', textBefore)}`,
  );
  const response = await deps.provider.generate(req);
  const usage = tokenUsageReport(req.feature, response.usage);
  deps.onUsage?.(usage);
  return { text: firstSentence(response.text), usage };
}
