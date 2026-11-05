import { ClaudeCodeTextProvider, type TextProvider } from '@muse-pen/story-engine';

// undefined를 돌려주면 createApp 기본값(FakeTextProvider)을 쓴다.
export function selectTextProvider(env: Record<string, string | undefined>): TextProvider | undefined {
  const name = env.TEXT_PROVIDER;
  if (!name || name === 'fake') return undefined;
  if (name === 'claude-code') {
    if (env.NODE_ENV === 'production') {
      throw new Error('TEXT_PROVIDER=claude-code는 운영에서 쓸 수 없다: 구독 토큰은 운영에 쓸 수 없고 개발 전용이다');
    }
    return new ClaudeCodeTextProvider();
  }
  throw new Error(`알 수 없는 TEXT_PROVIDER: ${name} (fake | claude-code)`);
}
