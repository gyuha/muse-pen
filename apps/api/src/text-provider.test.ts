import { ClaudeCodeTextProvider } from '@muse-pen/story-engine';
import { describe, expect, it } from 'vitest';
import { selectTextProvider } from './text-provider';

describe('TEXT_PROVIDER 선택', () => {
  it('TEXT_PROVIDER가 미설정·빈 값·fake이면 기본(가짜) 공급자를 쓴다', () => {
    expect(selectTextProvider({})).toBeUndefined();
    expect(selectTextProvider({ TEXT_PROVIDER: '' })).toBeUndefined();
    expect(selectTextProvider({ TEXT_PROVIDER: 'fake' })).toBeUndefined();
  });

  it('TEXT_PROVIDER=claude-code이면 ClaudeCodeTextProvider를 고른다', () => {
    expect(selectTextProvider({ TEXT_PROVIDER: 'claude-code' })).toBeInstanceOf(ClaudeCodeTextProvider);
  });

  it('NODE_ENV=production이면 TEXT_PROVIDER=claude-code는 시작을 거부한다', () => {
    expect(() => selectTextProvider({ TEXT_PROVIDER: 'claude-code', NODE_ENV: 'production' })).toThrow(/개발 전용/);
  });

  it('알 수 없는 TEXT_PROVIDER 값은 시작을 거부한다', () => {
    expect(() => selectTextProvider({ TEXT_PROVIDER: 'gpt' })).toThrow(/알 수 없는 TEXT_PROVIDER/);
  });
});
