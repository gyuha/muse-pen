import type { AiFeature, AiUsageAmount } from '@muse-pen/shared';

// 상위·하위 모델 ID. ghost text는 호출 빈도가 높아 하위 모델을 쓴다.
export interface ModelIds {
  main: string;
  light: string;
}
export const DEFAULT_MODELS: ModelIds = { main: 'claude-sonnet-5-5', light: 'claude-haiku-5-5' };

export type TextTask =
  | 'continue'
  | 'rewrite'
  | 'polish'
  | 'expand'
  | 'shrink'
  | 'draft'
  | 'ghost'
  | 'setting_check'
  | 'episode_completion';

export interface TextRequest {
  task: TextTask;
  feature: AiFeature;
  model: string;
  system: string;
  prompt: string;
}

// 호출 1회의 토큰 사용량. 공급자가 보고한다.
export interface TokenUsage {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

export interface TextResponse {
  text: string;
  usage: TokenUsage;
}

// 토큰 이벤트들 뒤에 usage 이벤트가 정확히 한 번 온다.
export type TextStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'usage'; usage: TokenUsage };

// 공급자 SDK 호출은 이 인터페이스 뒤(src/providers/)에만 둔다.
export interface TextProvider {
  generate(request: TextRequest): Promise<TextResponse>;
  stream(request: TextRequest): AsyncIterable<TextStreamEvent>;
}

// 호출당 사용량 보고. backend가 AI 사용 기록 1건으로 바꾼다.
export interface UsageReport {
  feature: AiFeature;
  modelId: string;
  usage: AiUsageAmount;
}
export type UsageReporter = (report: UsageReport) => void;

export function tokenUsageReport(feature: AiFeature, usage: TokenUsage): UsageReport {
  return {
    feature,
    modelId: usage.modelId,
    usage: { unit: 'tokens', inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
}

// 토큰 수 추정(한국어 위주라 2자 ≈ 1토큰). 상한 계산용이고 과금 값이 아니다.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}
