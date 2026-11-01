import { generateImage, type ImageQuality } from '@muse-pen/image-engine';
import { completeEpisode } from '@muse-pen/story-engine';
import type { Job, JobKind } from '@muse-pen/shared';
import { buildContextInput } from './context';
import type { JobHandler } from './worker';
import type { Repository } from './repository';
import type { Services } from './services';
import { newId, nowIso } from './util';

export interface ImageJobPayload { settingId: string; quality: ImageQuality }
export interface CompletionJobPayload { episodeId: string }

// 작업 종류별 처리기. 권한은 작업을 등록할 때 이미 확인했으므로 여기서는 작업의 workId·authorId를 믿는다.
export function createJobHandlers(s: () => Services): Record<JobKind, JobHandler> {
  return {
    async image_generation(job: Job) {
      const { repo, storage, imageProvider } = s();
      const { settingId, quality } = repo.getJobPayload<ImageJobPayload>(job.id);
      const setting = repo.getSetting(job.workId, settingId);
      const work = repo.getOwnedWork(job.authorId, job.workId);
      if (!setting || !work) throw new Error('작업 대상(설정 또는 작품)이 더 이상 없다');
      const imageId = newId();
      const style = work.concept.artStylePreset;
      const refIds = [...(setting.kind !== 'world' && setting.representativeImageId ? [setting.representativeImageId] : []), ...style.referenceImageIds];
      const generated = await generateImage(
        {
          setting, artStyle: style, referenceRecords: repo.listImagesByIds(work.id, refIds), quality,
          imageId, storageKey: `${work.id}/${imageId}`, createdAt: nowIso(),
        },
        {
          provider: imageProvider,
          storage,
          onUsage: (u) => s().recordUsage(job.authorId, 'image_generation', u.modelId, u.usage, u.estimatedCostUsd > 0 ? u.estimatedCostUsd : undefined),
        },
      );
      repo.insertImage(generated.record);
      return { imageId: generated.record.id, modelId: generated.record.modelId, mode: generated.mode };
    },

    async episode_completion(job: Job) {
      const { repo, textProvider } = s();
      const { episodeId } = repo.getJobPayload<CompletionJobPayload>(job.id);
      const work = repo.getOwnedWork(job.authorId, job.workId);
      const episode = work && repo.getEpisode(work.id, episodeId);
      if (!work || !episode) throw new Error('작업 대상(회차 또는 작품)이 더 이상 없다');
      const result = await completeEpisode(
        { provider: textProvider, onUsage: (u) => s().recordUsage(job.authorId, u.feature, u.modelId, u.usage) },
        buildContextInput(repo, work, episode),
      );
      persistCompletion(repo, work.id, episode.id, result);
      return { summary: result.summary, fieldChangeCount: result.fieldChanges.length };
    },
  };
}

function persistCompletion(
  repo: Repository,
  workId: string,
  episodeId: string,
  result: { summary: string; fieldChanges: { settingId: string; field: string; from: unknown; to: unknown; reason: string }[] },
): void {
  repo.transaction((tx) => {
    tx.putSummary(episodeId, result.summary, true);
    tx.addFieldChanges(workId, episodeId, result.fieldChanges);
  });
}
