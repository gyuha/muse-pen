import type { ContextInput } from '@muse-pen/story-engine';
import type { Episode, Id, Work } from '@muse-pen/shared';
import type { Repository } from './repository';

// DB에서 story-engine의 ContextInput으로 매핑한다. 조립 규칙(무엇을 넣고 뺄지)은 엔진이 정한다.
// currentText가 있으면 저장 전인 에디터 본문을 현재 회차 본문으로 쓴다.
export function buildContextInput(repo: Repository, work: Work, episode: Episode, currentText?: string): ContextInput {
  const resources = repo.listResources(work.id);
  return {
    concept: work.concept,
    synopsis: repo.getSynopsis(work.id),
    settings: repo.listSettings(work.id),
    pinnedSettingIds: repo.getPinnedSettingIds(episode.id),
    resources,
    pinnedResourceIds: repo.getPinnedResourceIds(episode.id),
    episodes: repo.listEpisodes(work.id).map((e) => ({
      id: e.id as Id, order: e.order, title: e.title, bodyText: e.bodyText, summary: repo.getSummary(e.id)?.content ?? null,
    })),
    currentEpisode: {
      id: episode.id, order: episode.order, title: episode.title,
      bodyText: currentText ?? episode.bodyText, plotMemo: repo.getPlotMemo(episode.id),
    },
  };
}
