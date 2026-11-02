import type { AiFeature, AiUsageAmount, Id, ImageStorage } from '@muse-pen/shared';
import type { ImageProvider } from '@muse-pen/image-engine';
import type { SearchProvider, TextProvider } from '@muse-pen/story-engine';
import type { Auth } from './auth';
import type { BlockDeriver } from './derive';
import type { PricingTable } from './pricing';
import type { Repository } from './repository';
import type { JobWorker } from './worker';

// 라우트·워커가 함께 쓰는 의존성 묶음. 공급자는 모두 주입 가능하고, 기본은 가짜 공급자다.
export interface Services {
  repo: Repository;
  auth: Auth;
  storage: ImageStorage;
  deriver: BlockDeriver;
  textProvider: TextProvider;
  imageProvider: ImageProvider;
  searchProvider: SearchProvider;
  pricing: PricingTable;
  worker: JobWorker;
  // AI 호출 1회당 사용 기록 1건을 남긴다.
  recordUsage(authorId: Id, feature: AiFeature, modelId: string, usage: AiUsageAmount, costUsd?: number): void;
}
