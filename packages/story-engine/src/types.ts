import type { Concept, Id, Resource, Setting } from '@muse-pen/shared';

// shared에는 회차 요약·플롯 메모·고정 지정이 없어서(backend 스키마 확정 전) 엔진 입력 형태를 여기서 정의한다.
export interface EpisodeContextInput {
  id: Id;
  order: number;
  title: string;
  bodyText: string;
  summary: string | null;
  // 다른 회차의 플롯 메모가 실려 와도 조립기는 쓰지 않는다.
  plotMemo?: string;
}

export interface CurrentEpisodeInput {
  id: Id;
  order: number;
  title: string;
  bodyText: string;
  plotMemo: string;
}

export interface ContextInput {
  concept: Concept;
  synopsis: string;
  settings: Setting[];
  pinnedSettingIds: Id[];
  resources: Resource[];
  pinnedResourceIds: Id[];
  episodes: EpisodeContextInput[];
  currentEpisode: CurrentEpisodeInput;
  // 직전 N개 회차 전문. 기본 2.
  recentEpisodeCount?: number;
  // 자료 몫 토큰 상한(추정치). 기본 1000.
  resourceTokenBudget?: number;
  // 사이드 패널 대화는 받아도 절대 컨텍스트에 넣지 않는다.
  sidePanelChat?: unknown;
}

export interface AssembledContext {
  text: string;
  included: {
    settingBodyIds: Id[];
    fullEpisodeIds: Id[];
    summaryEpisodeIds: Id[];
    resourceIds: Id[];
    hasPlotMemo: boolean;
  };
}
