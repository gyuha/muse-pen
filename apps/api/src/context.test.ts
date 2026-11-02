import { FakeTextProvider } from '@muse-pen/story-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { character, createTestApi, createWork, type TestApi } from './test-utils';

let t: TestApi;
afterEach(() => t?.cleanup());

// DB → 엔진 컨텍스트 매핑 확인. 포함·제외 규칙 자체는 story-engine이 검증한다.
describe('컨텍스트 매핑', () => {
  it('저장된 컨셉·시놉시스·설정·플롯 메모·회차 요약이 프롬프트에 실리고 사이드 패널 대화는 실리지 않는다', async () => {
    const provider = new FakeTextProvider(() => '끝.');
    t = createTestApi({ textProvider: provider });
    const a = (await t.signUp('a@x.com')).client;
    const w = await createWork(a);
    const base = `/api/works/${w.id}`;
    await a.json('PUT', `${base}/synopsis`, { content: '복수극 시놉시스' });
    await a.json('POST', `${base}/side-chat`, { role: 'user', content: '비밀 구상 대화' });
    const hit = (await a.json('POST', `${base}/settings`, { ...character('하린'), bodyJson: [{ type: 'paragraph', content: [{ type: 'text', text: '하린 본문' }] }] })).body;
    await a.json('POST', `${base}/settings`, { ...character('무명'), bodyJson: [{ type: 'paragraph', content: [{ type: 'text', text: '무명 본문' }] }] });
    const pinned = (await a.json('POST', `${base}/settings`, { ...character('고정이'), bodyJson: [{ type: 'paragraph', content: [{ type: 'text', text: '고정 본문' }] }] })).body;

    const e1 = (await a.json('POST', `${base}/episodes`, { title: '1화' })).body;
    for (let i = 2; i <= 4; i++) await a.json('POST', `${base}/episodes`, { title: `${i}화` });
    await a.json('PUT', `${base}/episodes/${e1.id}/summary`, { content: '1화 요약' });
    const e5 = (await a.json('POST', `${base}/episodes`, { title: '5화' })).body;
    await a.json('PUT', `${base}/episodes/${e5.id}/plot-memo`, { content: '플롯: 검을 줍는다' });
    await a.json('PUT', `${base}/episodes/${e5.id}/pinned-settings`, { ids: [pinned.id] });

    await (await a.req('POST', `${base}/episodes/${e5.id}/ai/continue`, { textBefore: '하린이 걸었다.', currentText: '하린이 걸었다.' })).text();
    const prompt = provider.requests[0]!.prompt;
    expect(prompt).toContain('장르: 무협');
    expect(prompt).toContain('복수극 시놉시스');
    expect(prompt).toContain('플롯: 검을 줍는다');
    expect(prompt).toContain('하린 본문'); // 현재 본문에 이름이 나온다
    expect(prompt).toContain('고정 본문'); // 고정 설정
    expect(prompt).not.toContain('무명 본문'); // 언급·고정 아님
    expect(prompt).toContain('1화 요약'); // 직전 2개 이전 회차는 요약으로
    expect(prompt).not.toContain('비밀 구상 대화');
    void hit;
  });
});
