import { describe, expect, it } from 'vitest';
import { findConflictWarnings } from './conflict';
import { continueWriting } from './generate';
import { FakeTextProvider } from './providers/fake';
import { baseInput, character } from './test-helpers';

const settings = [
  character('c1', '이운', { status: 'dead', aliases: ['검귀'] }),
  character('c2', '백설', { status: 'missing' }),
  character('c3', '무진', { status: 'alive' }),
];

describe('findConflictWarnings', () => {
  it('사망·행방불명 캐릭터의 이름이나 별칭이 나오면 경고한다', () => {
    const warnings = findConflictWarnings('검귀가 웃었다. 백설도 있었다.', settings);
    expect(warnings).toEqual([
      { settingId: 'c1', name: '이운', matchedText: '검귀', status: 'dead' },
      { settingId: 'c2', name: '백설', matchedText: '백설', status: 'missing' },
    ]);
  });

  it('생존 캐릭터나 언급이 없으면 경고하지 않는다', () => {
    expect(findConflictWarnings('무진이 걸었다.', settings)).toEqual([]);
    expect(findConflictWarnings('아무도 없었다.', settings)).toEqual([]);
  });
});

describe('AI 제안의 자동 경고', () => {
  it('경고 계산은 공급자를 추가로 부르지 않는다(생성 1회 외 호출 0회)', async () => {
    const provider = new FakeTextProvider(() => '이운이 돌아왔다.');
    const stream = continueWriting({ provider }, baseInput({ settings }), '앞 본문');
    for await (const _ of stream.tokens) void _;
    const suggestion = await stream.result;
    expect(suggestion.warnings.map((w) => w.settingId)).toEqual(['c1']);
    expect(provider.calls).toBe(1);
    const before = provider.calls;
    findConflictWarnings(suggestion.text, settings);
    expect(provider.calls).toBe(before);
  });

  it('경고 없음 + 순수 검사는 공급자 호출 0회', () => {
    const provider = new FakeTextProvider();
    expect(findConflictWarnings('이운이 돌아왔다.', settings)).toHaveLength(1);
    expect(provider.calls).toBe(0);
  });
});
