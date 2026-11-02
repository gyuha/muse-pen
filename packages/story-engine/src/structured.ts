import type { Id, Setting } from '@muse-pen/shared';
import { assembleContext } from './context';
import { buildRequest, type EngineDeps } from './generate';
import { section } from './prompts';
import { tokenUsageReport, type UsageReport } from './provider';
import type { ContextInput } from './types';

// 구조화 출력 파싱: 앞뒤 설명이 붙어도 첫 '{'부터 마지막 '}'까지를 JSON으로 읽는다.
function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('공급자 응답에서 JSON을 찾지 못했다');
  const value: unknown = JSON.parse(text.slice(start, end + 1));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('공급자 응답이 JSON 객체가 아니다');
  return value as Record<string, unknown>;
}

async function callStructured(
  deps: EngineDeps,
  task: 'setting_check' | 'episode_completion',
  feature: 'setting_check' | 'episode_completion',
  input: ContextInput,
  request: string,
): Promise<{ json: Record<string, unknown>; usage: UsageReport }> {
  const req = buildRequest(deps, task, feature, `${assembleContext(input).text}\n\n${request}`);
  const response = await deps.provider.generate(req);
  const usage = tokenUsageReport(feature, response.usage);
  deps.onUsage?.(usage);
  return { json: parseJsonObject(response.text), usage };
}

export interface SettingIssue {
  kind: 'contradiction' | 'field_body_mismatch';
  settingId: Id | null;
  description: string;
}

export interface SettingCheckResult {
  issues: SettingIssue[];
  usage: UsageReport;
}

// 설정 점검: 작가 요청 시에만 LLM을 부른다. 현재 회차 본문 + 정형 필드 + 관련 설정 본문이 컨텍스트에 실린다.
export async function checkSettings(deps: EngineDeps, input: ContextInput): Promise<SettingCheckResult> {
  const { json, usage } = await callStructured(
    deps,
    'setting_check',
    'setting_check',
    input,
    section('요청: 설정 점검', `다음 회차 본문을 설정과 대조한다.\n\n${input.currentEpisode.bodyText}`),
  );
  const raw = Array.isArray(json.issues) ? json.issues : [];
  const issues = raw.flatMap((item): SettingIssue[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { kind, settingId, description } = item as Record<string, unknown>;
    if ((kind !== 'contradiction' && kind !== 'field_body_mismatch') || typeof description !== 'string') return [];
    return [{ kind, settingId: typeof settingId === 'string' ? settingId : null, description }];
  });
  return { issues, usage };
}

// 필드 변경 AI 제안. 작가가 수락한 것만 정형 필드에 반영된다.
export interface FieldChangeCandidate {
  settingId: Id;
  field: string;
  from: unknown;
  to: unknown;
  reason: string;
}

export interface EpisodeCompletionResult {
  summary: string;
  fieldChanges: FieldChangeCandidate[];
  usage: UsageReport;
}

function validChange(item: unknown, settings: Setting[]): FieldChangeCandidate | null {
  if (typeof item !== 'object' || item === null) return null;
  const { settingId, field, to, reason } = item as Record<string, unknown>;
  if (typeof settingId !== 'string' || typeof field !== 'string') return null;
  const setting = settings.find((s) => s.id === settingId);
  // 존재하지 않는 설정이나 정형 필드가 아닌 항목(본문·id 등)에 대한 후보는 버린다.
  if (!setting || !Object.hasOwn(setting, field) || ['id', 'workId', 'kind', 'bodyJson', 'bodyText', 'bodyMarkdown', 'createdAt', 'updatedAt'].includes(field)) return null;
  return { settingId, field, from: (setting as Record<string, unknown>)[field], to, reason: typeof reason === 'string' ? reason : '' };
}

// 회차 완료 처리: 상위 모델 1회 호출로 회차 요약과 필드 변경 후보를 함께 만든다.
export async function completeEpisode(deps: EngineDeps, input: ContextInput): Promise<EpisodeCompletionResult> {
  const { json, usage } = await callStructured(
    deps,
    'episode_completion',
    'episode_completion',
    input,
    section('요청: 회차 완료 처리', `다음 완료된 회차 본문을 요약하고 설정 필드 변경 후보를 낸다.\n\n${input.currentEpisode.bodyText}`),
  );
  if (typeof json.summary !== 'string') throw new Error('회차 완료 응답에 summary가 없다');
  const raw = Array.isArray(json.fieldChanges) ? json.fieldChanges : [];
  const fieldChanges = raw.flatMap((item) => {
    const change = validChange(item, input.settings);
    return change ? [change] : [];
  });
  return { summary: json.summary, fieldChanges, usage };
}
