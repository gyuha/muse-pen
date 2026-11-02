import { describe, expect, it } from 'vitest';
import {
  adjustLength, continueWriting, draftEpisode, firstSentence, ghostText, polishStyle, rewriteSelection,
  type SuggestionStream,
} from './generate';
import { DEFAULT_MODELS, type UsageReport } from './provider';
import { FakeTextProvider } from './providers/fake';
import { baseInput, character } from './test-helpers';

async function drain(stream: SuggestionStream): Promise<string[]> {
  const tokens: string[] = [];
  for await (const t of stream.tokens) tokens.push(t);
  return tokens;
}

describe('스트리밍 기능', () => {
  it('토큰을 순서대로 흘려보내고 결과 텍스트와 일치한다', async () => {
    const provider = new FakeTextProvider(() => '첫째 둘째 셋째');
    const stream = continueWriting({ provider }, baseInput(), '앞');
    const tokens = await drain(stream);
    expect(tokens).toEqual(['첫째 ', '둘째 ', '셋째']);
    const suggestion = await stream.result;
    expect(suggestion.text).toBe('첫째 둘째 셋째');
    expect(suggestion.task).toBe('continue');
    expect(provider.calls).toBe(1);
  });

  it('호출당 사용량을 한 번 보고하고 모델 ID·입출력 토큰이 담긴다', async () => {
    const reports: UsageReport[] = [];
    const provider = new FakeTextProvider(() => '가나다라');
    const stream = continueWriting({ provider, onUsage: (r) => reports.push(r) }, baseInput(), '앞');
    await drain(stream);
    const { usage } = await stream.result;
    expect(reports).toEqual([usage]);
    expect(usage.feature).toBe('text_generation');
    expect(usage.modelId).toBe(DEFAULT_MODELS.main);
    expect(usage.usage).toMatchObject({ unit: 'tokens', outputTokens: 2 });
    expect(usage.usage.unit === 'tokens' && usage.usage.inputTokens).toBeGreaterThan(0);
  });

  it('작업 종류별로 요청과 프롬프트가 구성된다', async () => {
    const provider = new FakeTextProvider();
    const input = baseInput();
    for (const stream of [
      rewriteSelection({ provider }, input, '고칠 문장'),
      polishStyle({ provider }, input, '다듬을 문장'),
      adjustLength({ provider }, input, '늘릴 문장', 'expand'),
      adjustLength({ provider }, input, '줄일 문장', 'shrink'),
      draftEpisode({ provider }, baseInput({ currentEpisode: { id: 'e5', order: 5, title: 't', bodyText: '', plotMemo: '메모ABC' } })),
    ]) await drain(stream);
    expect(provider.requests.map((r) => r.task)).toEqual(['rewrite', 'polish', 'expand', 'shrink', 'draft']);
    expect(provider.requests[0]?.prompt).toContain('고칠 문장');
    expect(provider.requests[1]?.prompt).toContain('건조하고 냉소적');
    expect(provider.requests[4]?.prompt).toContain('메모ABC');
  });

  it('사이드 패널 대화는 프롬프트에 들어가지 않는다', async () => {
    const provider = new FakeTextProvider();
    await drain(continueWriting({ provider }, baseInput({ sidePanelChat: '폐기안' }), '앞'));
    expect(provider.requests[0]?.prompt).not.toContain('폐기안');
  });

  it('공급자 오류는 스트림과 result 양쪽에 전달된다', async () => {
    const provider = new FakeTextProvider(() => {
      throw new Error('boom');
    });
    const stream = continueWriting({ provider }, baseInput(), '앞');
    await expect(drain(stream)).rejects.toThrow('boom');
    await expect(stream.result).rejects.toThrow('boom');
  });

  it('AI 제안에 자동 경고가 붙는다', async () => {
    const provider = new FakeTextProvider(() => '이운이 웃었다.');
    const stream = rewriteSelection({ provider }, baseInput({ settings: [character('c1', '이운', { status: 'dead' })] }), '문장');
    await drain(stream);
    expect((await stream.result).warnings).toHaveLength(1);
  });
});

describe('ghost text', () => {
  it('한 문장 이내로 자르고 하위 모델 ID를 쓴다', async () => {
    const provider = new FakeTextProvider(() => '그는 문을 열었다. 그리고 안으로 들어갔다. 끝.');
    const reports: UsageReport[] = [];
    const ghost = await ghostText({ provider, onUsage: (r) => reports.push(r) }, baseInput(), '앞 본문');
    expect(ghost.text).toBe('그는 문을 열었다.');
    expect(provider.requests[0]?.model).toBe(DEFAULT_MODELS.light);
    expect(ghost.usage.modelId).toBe(DEFAULT_MODELS.light);
    expect(ghost.usage.feature).toBe('ghost_text');
    expect(reports).toHaveLength(1);
  });

  it('축약 컨텍스트: 이전 회차를 넣지 않는다', async () => {
    const provider = new FakeTextProvider();
    const episodes = [{ id: 'e4', order: 4, title: 't', bodyText: '직전전문QQ', summary: '요약QQ' }];
    await ghostText({ provider }, baseInput({ episodes }), '앞');
    expect(provider.requests[0]?.prompt).not.toContain('직전전문QQ');
  });

  it('firstSentence는 문장 부호·줄바꿈 기준으로 자른다', () => {
    expect(firstSentence('  안녕하세요! 반갑습니다.')).toBe('안녕하세요!');
    expect(firstSentence('"가자." 그가 말했다. 다음')).toBe('"가자."');
    expect(firstSentence('끝나지 않는 문장\n둘째 줄.')).toBe('끝나지 않는 문장');
    expect(firstSentence('')).toBe('');
  });
});
