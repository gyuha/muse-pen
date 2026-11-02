import type { AiUsageAmount } from '@muse-pen/shared';

// 모델 ID별 단가(USD). 공급자 공시 단가를 운영자가 채운다 — 이 저장소는 단가를 추측하지 않는다.
// 표에 없는 모델(가짜 공급자 포함)은 추정 비용 0으로 기록한다.
export interface ModelPrice {
  inputPerMillionTokens?: number;
  outputPerMillionTokens?: number;
  perImage?: number;
  perSearch?: number;
}
export type PricingTable = Record<string, ModelPrice>;

export const DEFAULT_PRICING: PricingTable = {};

export function estimateCost(table: PricingTable, modelId: string, usage: AiUsageAmount): number {
  const price = table[modelId];
  if (!price) return 0;
  switch (usage.unit) {
    case 'tokens':
      return (
        (usage.inputTokens * (price.inputPerMillionTokens ?? 0) + usage.outputTokens * (price.outputPerMillionTokens ?? 0)) / 1_000_000
      );
    case 'images':
      return usage.count * (price.perImage ?? 0);
    case 'searches':
      return usage.count * (price.perSearch ?? 0);
  }
}
