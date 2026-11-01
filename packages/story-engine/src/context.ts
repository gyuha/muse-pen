import type { Id, Resource, Setting } from '@muse-pen/shared';
import { estimateTokens } from './provider';
import type { AssembledContext, ContextInput } from './types';

const DEFAULT_RECENT_EPISODES = 2;
const DEFAULT_RESOURCE_TOKEN_BUDGET = 1000;

// 본문 선별에 쓰는 이름·별칭. 별칭은 캐릭터에만 있다.
function settingNames(setting: Setting): string[] {
  return setting.kind === 'character' ? [setting.name, ...setting.aliases] : [setting.name];
}

const NON_FIELD_KEYS = new Set([
  'id',
  'workId',
  'bodyJson',
  'bodyText',
  'bodyMarkdown',
  'createdAt',
  'updatedAt',
  'representativeImageId',
]);

function renderFields(setting: Setting): string {
  const parts = Object.entries(setting)
    .filter(([key, value]) => key !== 'kind' && !NON_FIELD_KEYS.has(key) && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  return `- [${setting.kind}] ${parts.join(' | ')}`;
}

function renderResource(resource: Resource): string {
  // 인용문·URL·웹 원문은 넣지 않는다(프롬프트 인젝션 차단).
  return `- ${resource.title}: ${resource.summary}`;
}

function selectResources(input: ContextInput, mentionText: string): Resource[] {
  const pinned = new Set<Id>(input.pinnedResourceIds);
  const wanted = input.resources.filter(
    (r) => pinned.has(r.id) || mentionText.includes(r.title) || r.tags.some((tag) => mentionText.includes(tag)),
  );
  // 고정 자료를 먼저 채우고, 상한을 넘기는 자료는 건너뛴다.
  const ordered = [...wanted.filter((r) => pinned.has(r.id)), ...wanted.filter((r) => !pinned.has(r.id))];
  let used = 0;
  const budget = input.resourceTokenBudget ?? DEFAULT_RESOURCE_TOKEN_BUDGET;
  const chosen: Resource[] = [];
  for (const resource of ordered) {
    const cost = estimateTokens(renderResource(resource));
    if (used + cost > budget) continue;
    used += cost;
    chosen.push(resource);
  }
  return chosen;
}

// 순수 함수: 같은 입력에 항상 같은 결과. 설정 본문 선별은 이름·별칭 문자열 매칭이다.
export function assembleContext(input: ContextInput): AssembledContext {
  const { concept, currentEpisode } = input;
  const recentCount = input.recentEpisodeCount ?? DEFAULT_RECENT_EPISODES;

  const pinnedSettings = new Set<Id>(input.pinnedSettingIds);
  const bodySettings = input.settings.filter(
    (s) => pinnedSettings.has(s.id) || settingNames(s).some((name) => currentEpisode.bodyText.includes(name)),
  );

  const earlier = input.episodes
    .filter((e) => e.id !== currentEpisode.id && e.order < currentEpisode.order)
    .sort((a, b) => a.order - b.order);
  const recent = recentCount > 0 ? earlier.slice(-recentCount) : [];
  const summarized = earlier.slice(0, earlier.length - recent.length).filter((e) => e.summary);

  const resources = selectResources(input, `${currentEpisode.bodyText}\n${currentEpisode.plotMemo}`);

  const sections: string[] = [
    [
      '## 컨셉',
      `장르: ${concept.genre}`,
      `톤: ${concept.tone}`,
      `서술 시점: ${concept.pointOfView === 'first_person' ? '1인칭' : '3인칭'}`,
      `타깃 독자: ${concept.targetReader}`,
    ].join('\n'),
    `## 시놉시스\n${input.synopsis}`,
    ['## 설정 (정형 필드)', ...input.settings.map(renderFields)].join('\n'),
  ];
  if (bodySettings.length > 0) {
    sections.push(['## 설정 본문', ...bodySettings.map((s) => `### ${s.name}\n${s.bodyText}`)].join('\n'));
  }
  if (summarized.length > 0) {
    sections.push(['## 이전 회차 요약', ...summarized.map((e) => `### ${e.order}. ${e.title}\n${e.summary}`)].join('\n'));
  }
  if (recent.length > 0) {
    sections.push(['## 직전 회차 전문', ...recent.map((e) => `### ${e.order}. ${e.title}\n${e.bodyText}`)].join('\n'));
  }
  if (resources.length > 0) {
    sections.push(['## 자료 (제목·요약)', ...resources.map(renderResource)].join('\n'));
  }
  if (currentEpisode.plotMemo) {
    sections.push(`## 이번 회차 플롯 메모\n${currentEpisode.plotMemo}`);
  }

  return {
    text: sections.join('\n\n'),
    included: {
      settingBodyIds: bodySettings.map((s) => s.id),
      fullEpisodeIds: recent.map((e) => e.id),
      summaryEpisodeIds: summarized.map((e) => e.id),
      resourceIds: resources.map((r) => r.id),
      hasPlotMemo: currentEpisode.plotMemo !== '',
    },
  };
}
