import { describe, expect, it } from 'vitest';
import { FakeTextProvider } from './providers/fake';
import { checkSettings, completeEpisode } from './structured';
import { baseInput, character } from './test-helpers';
import type { UsageReport } from './provider';

const settings = [character('c1', '이운', { status: 'alive' })];

describe('completeEpisode', () => {
  it('회차 요약과 필드 변경 후보를 낸다(from은 현재 값, 잘못된 후보는 버림)', async () => {
    const provider = new FakeTextProvider(() =>
      '결과:\n' + JSON.stringify({
        summary: '이운이 죽었다.',
        fieldChanges: [
          { settingId: 'c1', field: 'status', to: 'dead', reason: '전사' },
          { settingId: 'nope', field: 'status', to: 'dead', reason: 'x' },
          { settingId: 'c1', field: 'bodyText', to: '조작', reason: 'x' },
          { settingId: 'c1', field: 'unknown', to: 1, reason: 'x' },
        ],
      }),
    );
    const reports: UsageReport[] = [];
    const result = await completeEpisode({ provider, onUsage: (r) => reports.push(r) }, baseInput({ settings }));
    expect(result.summary).toBe('이운이 죽었다.');
    expect(result.fieldChanges).toEqual([{ settingId: 'c1', field: 'status', from: 'alive', to: 'dead', reason: '전사' }]);
    expect(provider.calls).toBe(1);
    expect(result.usage.feature).toBe('episode_completion');
    expect(reports).toEqual([result.usage]);
  });

  it('JSON이 아니면 오류를 던진다', async () => {
    const provider = new FakeTextProvider(() => '요약 없음');
    await expect(completeEpisode({ provider }, baseInput())).rejects.toThrow('JSON');
  });
});

describe('checkSettings', () => {
  it('모순·필드/본문 불일치 목록을 반환한다', async () => {
    const provider = new FakeTextProvider(() =>
      JSON.stringify({
        issues: [
          { kind: 'field_body_mismatch', settingId: 'c1', description: '필드는 금발, 본문은 흑발' },
          { kind: 'contradiction', description: '시간선 오류' },
          { kind: 'other', description: '버려짐' },
        ],
      }),
    );
    const result = await checkSettings({ provider }, baseInput({ settings }));
    expect(result.issues).toEqual([
      { kind: 'field_body_mismatch', settingId: 'c1', description: '필드는 금발, 본문은 흑발' },
      { kind: 'contradiction', settingId: null, description: '시간선 오류' },
    ]);
    expect(result.usage.feature).toBe('setting_check');
  });

  it('가짜 공급자 기본 응답은 빈 목록이다', async () => {
    const result = await checkSettings({ provider: new FakeTextProvider() }, baseInput());
    expect(result.issues).toEqual([]);
  });
});
