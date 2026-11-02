import { assembleContext, findConflictWarnings, FakeTextProvider, type ContextInput } from '@muse-pen/story-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { character, createHarness, createWork, parseSse, para, type Harness } from './helpers';

// --- 엔진 직접 입력 빌더 ---
const T = '2026-01-01T00:00:00.000Z';
const common = { workId: 'w1', bodyJson: null, bodyMarkdown: '', createdAt: T, updatedAt: T };
const concept = {
  genre: '사이버무협', tone: '건조하고 냉소적', pointOfView: 'third_person' as const, targetReader: '2030 남성독자',
  artStylePreset: { prompt: '수묵화', referenceImageIds: [] as string[] },
};
const ch = (id: string, name: string, over: Record<string, unknown> = {}): any => ({
  kind: 'character', id, name, aliases: [], gender: '남', ageGroup: '20대', appearanceKeywords: ['흑발'], status: 'alive',
  representativeImageId: null, bodyText: `BODY<${name}>`, ...common, ...over,
});
const loc = (id: string, name: string): any => ({
  kind: 'location', id, name, placeType: '객잔', eraMoodKeywords: ['고풍'], representativeImageId: null, bodyText: `BODY<${name}>`, ...common,
});
const res = (id: string, title: string, over: Record<string, unknown> = {}): any => ({
  id, workId: 'w1', title, question: 'q', summary: `SUMMARY<${title}>`, unverified: false, tags: [],
  sources: [{ url: 'https://evil.example/secret-url', title: 't', quote: 'QUOTE-SECRET', retrievedAt: T }], createdAt: T, updatedAt: T, ...over,
});
const ep = (order: number, over: Record<string, unknown> = {}) => ({
  id: `e${order}`, order, title: `${order}화`, bodyText: `FULL<${order}>`, summary: `SUM<${order}>`, ...over,
});
const input = (over: Partial<ContextInput> = {}): ContextInput => ({
  concept, synopsis: 'SYNOPSIS-MARK', settings: [], pinnedSettingIds: [], resources: [], pinnedResourceIds: [], episodes: [],
  currentEpisode: { id: 'cur', order: 10, title: '열번째', bodyText: '', plotMemo: '' }, ...over,
});
const cur = (over: Record<string, unknown> = {}) => ({ id: 'cur', order: 10, title: '열번째', bodyText: '', plotMemo: '', ...over });

describe('[AC-10] 컨텍스트 조립 규칙(포함·제외)', () => {
  it('[AC-10] 컨셉(장르·톤·서술 시점·타깃 독자)과 시놉시스는 항상 포함된다', () => {
    const { text } = assembleContext(input());
    for (const s of ['사이버무협', '건조하고 냉소적', '2030 남성독자', 'SYNOPSIS-MARK']) expect(text).toContain(s);
    expect(text).toContain('3인칭');
    expect(assembleContext(input({ concept: { ...concept, pointOfView: 'first_person' } })).text).toContain('1인칭');
  });

  it('[AC-10] 모든 설정의 정형 필드는 본문에 이름이 안 나오고 고정되지 않아도 항상 포함된다(4종 모두)', () => {
    const settings = [
      ch('c1', '하린', { gender: '여', ageGroup: '십대', appearanceKeywords: ['은발'], aliases: ['린'] }),
      loc('l1', '청풍객잔'),
      { kind: 'prop', id: 'p1', name: '청룡검', ownerCharacterId: 'c1', appearanceKeywords: ['푸른날'], representativeImageId: null, bodyText: 'BODY<청룡검>', ...common },
      { kind: 'world', id: 'x1', name: '강호', rulesSummary: '내공규칙요약', bodyText: 'BODY<강호>', ...common },
    ];
    const { text, included } = assembleContext(input({ settings, currentEpisode: cur({ bodyText: '아무 이름도 나오지 않는 본문' }) }));
    for (const s of ['하린', '여', '십대', '은발', '청풍객잔', '객잔', '고풍', '청룡검', '푸른날', '강호', '내공규칙요약']) expect(text, s).toContain(s);
    expect(included.settingBodyIds).toEqual([]); // 정형 필드만 들어가고 본문은 안 들어간다
    expect(text).not.toContain('BODY<');
  });

  it('[AC-10] 설정 본문: 현재 회차에 이름이 나오면 포함, 안 나오면 제외', () => {
    const settings = [ch('c1', '하린'), ch('c2', '무진')];
    const r = assembleContext(input({ settings, currentEpisode: cur({ bodyText: '하린은 문을 열었다.' }) }));
    expect(r.text).toContain('BODY<하린>');
    expect(r.text).not.toContain('BODY<무진>');
    expect(r.included.settingBodyIds).toEqual(['c1']);
  });

  it('[AC-10] 설정 본문: 별칭이 나와도 포함된다(장소 등 이름이 나오는 다른 종류도 포함)', () => {
    const settings = [ch('c1', '하린', { aliases: ['검은 여우'] }), loc('l1', '청풍객잔'), ch('c2', '무진')];
    const r = assembleContext(input({ settings, currentEpisode: cur({ bodyText: '검은 여우가 청풍객잔에 들어섰다.' }) }));
    expect(r.included.settingBodyIds.sort()).toEqual(['c1', 'l1']);
    expect(r.text).toContain('BODY<하린>');
    expect(r.text).toContain('BODY<청풍객잔>');
    expect(r.text).not.toContain('BODY<무진>');
  });

  it('[AC-10] 설정 본문: 이름이 안 나와도 고정 설정이면 포함, 고정도 아니고 안 나오면 제외', () => {
    const settings = [ch('c1', '하린'), ch('c2', '무진'), ch('c3', '여운')];
    const r = assembleContext(input({ settings, pinnedSettingIds: ['c2'], currentEpisode: cur({ bodyText: '아무도 안 나온다' }) }));
    expect(r.included.settingBodyIds).toEqual(['c2']);
    expect(r.text).toContain('BODY<무진>');
    expect(r.text).not.toContain('BODY<하린>');
    expect(r.text).not.toContain('BODY<여운>');
  });

  it('[AC-10] 다른 회차 본문에만 나오는 이름은 설정 본문을 끌어오지 않는다(현재 회차 기준)', () => {
    const settings = [ch('c1', '하린')];
    const r = assembleContext(input({ settings, episodes: [ep(9, { bodyText: '하린이 등장하는 직전 회차' })], currentEpisode: cur({ bodyText: '다른 내용' }) }));
    expect(r.included.settingBodyIds).toEqual([]);
    expect(r.text).not.toContain('BODY<하린>');
  });

  it('[AC-10] 플롯 메모: 현재 회차 것은 포함, 다른 회차의 것은 제외', () => {
    const episodes = [ep(8, { plotMemo: 'OTHER-PLOT-8' }), ep(9, { plotMemo: 'OTHER-PLOT-9' })];
    const r = assembleContext(input({ episodes, currentEpisode: cur({ plotMemo: 'MY-PLOT-MEMO' }) }));
    expect(r.text).toContain('MY-PLOT-MEMO');
    expect(r.included.hasPlotMemo).toBe(true);
    expect(r.text).not.toContain('OTHER-PLOT');
    const none = assembleContext(input({ episodes, currentEpisode: cur({ plotMemo: '' }) }));
    expect(none.included.hasPlotMemo).toBe(false);
    expect(none.text).not.toContain('OTHER-PLOT');
  });

  it('[AC-10] 직전 N개 회차는 전문, 그 이전은 요약으로 포함된다(기본 N=2)', () => {
    const episodes = [1, 2, 3, 4, 5].map((n) => ep(n));
    const r = assembleContext(input({ episodes, currentEpisode: cur({ order: 6 }) }));
    expect(r.included.fullEpisodeIds).toEqual(['e4', 'e5']);
    expect(r.included.summaryEpisodeIds).toEqual(['e1', 'e2', 'e3']);
    for (const n of [4, 5]) { expect(r.text).toContain(`FULL<${n}>`); expect(r.text).not.toContain(`SUM<${n}>`); }
    for (const n of [1, 2, 3]) { expect(r.text).toContain(`SUM<${n}>`); expect(r.text).not.toContain(`FULL<${n}>`); }
  });

  it('[AC-10] N을 바꾸면 그만큼만 전문이다(N=1, N=3)', () => {
    const episodes = [1, 2, 3, 4].map((n) => ep(n));
    const n1 = assembleContext(input({ episodes, recentEpisodeCount: 1, currentEpisode: cur({ order: 5 }) }));
    expect(n1.included.fullEpisodeIds).toEqual(['e4']);
    expect(n1.included.summaryEpisodeIds).toEqual(['e1', 'e2', 'e3']);
    const n3 = assembleContext(input({ episodes, recentEpisodeCount: 3, currentEpisode: cur({ order: 5 }) }));
    expect(n3.included.fullEpisodeIds).toEqual(['e2', 'e3', 'e4']);
    expect(n3.included.summaryEpisodeIds).toEqual(['e1']);
  });

  it('[AC-10] 현재 회차 자신과 뒤 회차는 이전 회차 전문·요약으로 들어가지 않는다', () => {
    const episodes = [ep(1), ep(2), ep(3, { id: 'cur', bodyText: 'FULL<cur>', summary: 'SUM<cur>' }), ep(4)];
    const r = assembleContext(input({ episodes, currentEpisode: cur({ id: 'cur', order: 3 }) }));
    expect(r.included.fullEpisodeIds).toEqual(['e1', 'e2']);
    expect(r.text).not.toContain('FULL<4>');
    expect(r.text).not.toContain('SUM<4>');
    expect(r.text).not.toContain('FULL<cur>');
    expect(r.text).not.toContain('SUM<cur>');
  });

  it('[AC-10] 사이드 패널 대화는 입력으로 들어와도 컨텍스트에 포함되지 않는다', () => {
    const r = assembleContext(input({ sidePanelChat: [{ role: 'user', content: 'SIDE-CHAT-DISCARDED-IDEA' }] }));
    expect(r.text).not.toContain('SIDE-CHAT-DISCARDED-IDEA');
    expect(JSON.stringify(r.included)).not.toContain('SIDE-CHAT');
  });

  it('[AC-10] 자료: 고정된 자료는 제목·요약만 포함된다(인용문·URL은 제외)', () => {
    const r = assembleContext(input({ resources: [res('r1', '조선복식')], pinnedResourceIds: ['r1'] }));
    expect(r.included.resourceIds).toEqual(['r1']);
    expect(r.text).toContain('조선복식');
    expect(r.text).toContain('SUMMARY<조선복식>');
    expect(r.text).not.toContain('QUOTE-SECRET');
    expect(r.text).not.toContain('secret-url');
  });

  it('[AC-10] 자료: 회차 본문·플롯 메모에 제목이 언급되면 포함, 고정도 언급도 없으면 제외', () => {
    const resources = [res('r1', '조선복식'), res('r2', '고려청자'), res('r3', '발해사')];
    const byBody = assembleContext(input({ resources, currentEpisode: cur({ bodyText: '그는 조선복식을 입었다.' }) }));
    expect(byBody.included.resourceIds).toEqual(['r1']);
    const byMemo = assembleContext(input({ resources, currentEpisode: cur({ plotMemo: '고려청자를 훔친다' }) }));
    expect(byMemo.included.resourceIds).toEqual(['r2']);
    const none = assembleContext(input({ resources, currentEpisode: cur({ bodyText: '관계 없는 본문' }) }));
    expect(none.included.resourceIds).toEqual([]);
    expect(none.text).not.toContain('SUMMARY<');
    expect(none.text).not.toContain('QUOTE-SECRET');
  });

  it('[AC-10] 같은 입력이면 항상 같은 결과다(결정적)', () => {
    const i = input({ settings: [ch('c1', '하린')], episodes: [ep(1), ep(2)], currentEpisode: cur({ order: 3, bodyText: '하린' }) });
    expect(assembleContext(i)).toEqual(assembleContext(i));
  });
});

// --- api 경유: DB 상태가 실제 AI 요청 컨텍스트로 이어지는지 ---
let t: Harness;
afterEach(() => t?.cleanup());

describe('[AC-10] api 경유 컨텍스트 조립', () => {
  it('[AC-10] 저장된 시놉시스·설정·플롯 메모·회차가 규칙대로 실제 공급자 요청에 실린다', async () => {
    const provider = new FakeTextProvider(() => '결과.');
    t = createHarness({ textProvider: provider });
    const a = await t.signUp('a@x.com');
    const w = (await createWork(a)).id;
    await a.json('PUT', `/api/works/${w}/synopsis`, { content: 'API-SYNOPSIS' });
    const hari = (await a.json('POST', `/api/works/${w}/settings`, { ...character('하린'), bodyJson: [para('하린 설정본문')] })).body;
    await a.json('POST', `/api/works/${w}/settings`, { ...character('무진'), bodyJson: [para('무진 설정본문')] });
    const e1 = (await a.json('POST', `/api/works/${w}/episodes`, { title: '1화', bodyJson: [para('1화 전문 내용')] })).body;
    await a.json('PUT', `/api/works/${w}/episodes/${e1.id}/plot-memo`, { content: '1화-플롯' });
    const e2 = (await a.json('POST', `/api/works/${w}/episodes`, { title: '2화', bodyJson: [para('하린이 걷는다')] })).body;
    await a.json('PUT', `/api/works/${w}/episodes/${e2.id}/plot-memo`, { content: '2화-플롯' });
    await a.json('POST', `/api/works/${w}/side-chat`, { role: 'user', content: '버린아이디어-사이드챗' });

    const res = await a.req('POST', `/api/works/${w}/episodes/${e2.id}/ai/continue`, { textBefore: '하린이 걷는다' });
    await res.text();
    expect(provider.calls).toBe(1);
    const prompt = provider.requests[0]!.prompt;
    expect(prompt).toContain('API-SYNOPSIS');
    expect(prompt).toContain('무협'); // 컨셉(장르)
    expect(prompt).toContain('하린 설정본문'); // 이름이 본문에 나옴 → 포함
    expect(prompt).not.toContain('무진 설정본문'); // 안 나옴 → 제외
    expect(prompt).toContain('무진'); // 정형 필드는 항상
    expect(prompt).toContain('2화-플롯'); // 현재 회차 메모
    expect(prompt).not.toContain('1화-플롯'); // 다른 회차 메모
    expect(prompt).toContain('1화 전문 내용'); // 직전 회차 전문
    expect(prompt).not.toContain('버린아이디어-사이드챗'); // 사이드 패널 대화

    // 고정 설정이면 이름이 안 나와도 본문이 실린다
    await a.json('PUT', `/api/works/${w}/episodes/${e2.id}/pinned-settings`, { ids: [hari.id] });
    await (await a.req('POST', `/api/works/${w}/episodes/${e2.id}/ai/continue`, { textBefore: 'x', currentText: '아무도 안 나온다' })).text();
    const second = provider.requests[1]!.prompt;
    expect(second).toContain('하린 설정본문');
    expect(second).not.toContain('무진 설정본문');
  });
});

describe('[AC-11] 설정 충돌 자동 경고', () => {
  const settings = [
    ch('c1', '하린', { status: 'dead', aliases: ['검은 여우'] }),
    ch('c2', '무진', { status: 'missing', aliases: ['야인'] }),
    ch('c3', '여운', { status: 'alive', aliases: ['바람'] }),
    loc('l1', '청풍객잔'),
  ];

  it('[AC-11] 사망 캐릭터의 이름이 제안에 나오면 경고가 붙는다(사유 상태 포함)', () => {
    const w = findConflictWarnings('하린이 웃으며 걸어 들어왔다.', settings);
    expect(w).toEqual([{ settingId: 'c1', name: '하린', matchedText: '하린', status: 'dead' }]);
  });

  it('[AC-11] 사망 캐릭터의 별칭만 나와도 경고가 붙는다', () => {
    const w = findConflictWarnings('검은 여우가 칼을 뽑았다.', settings);
    expect(w).toMatchObject([{ settingId: 'c1', name: '하린', matchedText: '검은 여우', status: 'dead' }]);
  });

  it('[AC-11] 행방불명 캐릭터의 이름·별칭이 나오면 경고가 붙는다', () => {
    expect(findConflictWarnings('무진은 말이 없었다.', settings)).toMatchObject([{ settingId: 'c2', status: 'missing', matchedText: '무진' }]);
    expect(findConflictWarnings('야인이 나타났다.', settings)).toMatchObject([{ settingId: 'c2', status: 'missing', matchedText: '야인' }]);
  });

  it('[AC-11] 여러 명이 나오면 각각 경고가 붙는다', () => {
    const w = findConflictWarnings('하린과 무진이 마주 보았다.', settings);
    expect(w.map((x) => x.settingId).sort()).toEqual(['c1', 'c2']);
  });

  it('[AC-11] 생존 캐릭터·장소만 나오거나 아무도 안 나오면 경고가 없다', () => {
    expect(findConflictWarnings('여운과 바람이 청풍객잔에 도착했다.', settings)).toEqual([]);
    expect(findConflictWarnings('아무도 없는 빈 방이었다.', settings)).toEqual([]);
    expect(findConflictWarnings('', settings)).toEqual([]);
    expect(findConflictWarnings('하린', [])).toEqual([]);
  });

  it('[AC-11] 상태가 생존으로 바뀐 캐릭터는 더 이상 경고하지 않는다', () => {
    const revived = settings.map((s) => (s.id === 'c1' ? { ...s, status: 'alive' } : s));
    expect(findConflictWarnings('하린이 웃었다.', revived)).toEqual([]);
  });

  it('[AC-11] api: 제안에 사망 캐릭터가 나오면 SSE 제안에 경고가 붙고, 가짜 공급자는 생성 호출 1회뿐이다(경고 검사에 LLM 호출 없음)', async () => {
    const provider = new FakeTextProvider(() => '하린이 웃었다. 무진도 있었다. 여운은 조용했다.');
    t = createHarness({ textProvider: provider });
    const a = await t.signUp('a@x.com');
    const w = (await createWork(a)).id;
    await a.json('POST', `/api/works/${w}/settings`, character('하린', { status: 'dead' }));
    await a.json('POST', `/api/works/${w}/settings`, character('무진', { status: 'missing' }));
    await a.json('POST', `/api/works/${w}/settings`, character('여운', { status: 'alive' }));
    const e = (await a.json('POST', `/api/works/${w}/episodes`, { title: '1화' })).body;
    const events = parseSse(await (await a.req('POST', `/api/works/${w}/episodes/${e.id}/ai/continue`, { textBefore: '시작' })).text());
    const suggestion = events.find((x) => x.event === 'suggestion')!.data;
    expect(suggestion.warnings.map((x: any) => [x.name, x.status]).sort()).toEqual([['무진', 'missing'], ['하린', 'dead']]);
    expect(provider.calls).toBe(1);
    expect(provider.requests.map((r) => r.task)).toEqual(['continue']);
    expect(events.at(-1)!.event).toBe('done');
  });

  it('[AC-11] api: 사망·행방불명 캐릭터가 안 나오는 제안에는 경고가 없고, 호출은 여전히 1회다', async () => {
    const provider = new FakeTextProvider(() => '여운이 웃었다.');
    t = createHarness({ textProvider: provider });
    const a = await t.signUp('a@x.com');
    const w = (await createWork(a)).id;
    await a.json('POST', `/api/works/${w}/settings`, character('하린', { status: 'dead' }));
    await a.json('POST', `/api/works/${w}/settings`, character('여운'));
    const e = (await a.json('POST', `/api/works/${w}/episodes`, { title: '1화' })).body;
    const events = parseSse(await (await a.req('POST', `/api/works/${w}/episodes/${e.id}/ai/continue`, { textBefore: '시작' })).text());
    expect(events.find((x) => x.event === 'suggestion')!.data.warnings).toEqual([]);
    expect(provider.calls).toBe(1);
  });

  it('[AC-11] api: 다섯 가지 대화형 기능 모두 호출 1회당 경고 검사가 추가 호출을 만들지 않는다', async () => {
    const provider = new FakeTextProvider(() => '하린이 나왔다.');
    t = createHarness({ textProvider: provider });
    const a = await t.signUp('a@x.com');
    const w = (await createWork(a)).id;
    await a.json('POST', `/api/works/${w}/settings`, character('하린', { status: 'dead' }));
    const e = (await a.json('POST', `/api/works/${w}/episodes`, { title: '1화' })).body;
    const base = `/api/works/${w}/episodes/${e.id}/ai`;
    let expected = 0;
    for (const [task, body] of [['continue', { textBefore: 'x' }], ['rewrite', { selection: 'x' }], ['polish', { selection: 'x' }], ['expand', { selection: 'x' }], ['shrink', { selection: 'x' }], ['draft', {}]] as const) {
      const events = parseSse(await (await a.req('POST', `${base}/${task}`, body)).text());
      expected += 1;
      expect(events.find((x) => x.event === 'suggestion')!.data.warnings, task).toMatchObject([{ name: '하린', status: 'dead' }]);
      expect(provider.calls, task).toBe(expected);
    }
  });
});
