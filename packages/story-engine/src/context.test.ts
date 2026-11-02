import { describe, expect, it } from 'vitest';
import { assembleContext } from './context';
import { baseInput, character, location, resource } from './test-helpers';
import type { EpisodeContextInput } from './types';

const ep = (order: number, over: Partial<EpisodeContextInput> = {}): EpisodeContextInput => ({
  id: `e${order}`, order, title: `${order}화`, bodyText: `${order}화 전문`, summary: `${order}화 요약`, ...over,
});

describe('assembleContext', () => {
  it('컨셉·시놉시스·모든 설정의 정형 필드는 항상 들어간다', () => {
    const { text } = assembleContext(baseInput({ settings: [character('c1', '이운'), location('l1', '청풍객잔')] }));
    expect(text).toContain('무협');
    expect(text).toContain('건조하고 냉소적');
    expect(text).toContain('복수극 시놉시스');
    expect(text).toContain('이운');
    expect(text).toContain('청풍객잔');
    expect(text).toContain('흑발');
  });

  it('설정 본문은 이름·별칭이 회차 본문에 나올 때만 들어간다', () => {
    const settings = [character('c1', '이운', { aliases: ['검귀'] }), character('c2', '백설'), location('l1', '청풍객잔')];
    const input = baseInput({ settings, currentEpisode: { id: 'e5', order: 5, title: 't', bodyText: '검귀가 걸어왔다.', plotMemo: '' } });
    const { text, included } = assembleContext(input);
    expect(included.settingBodyIds).toEqual(['c1']);
    expect(text).toContain('이운 본문');
    expect(text).not.toContain('백설 본문');
    expect(text).not.toContain('청풍객잔 본문');
  });

  it('고정 설정은 언급이 없어도 본문이 들어간다', () => {
    const { included } = assembleContext(baseInput({ settings: [character('c2', '백설')], pinnedSettingIds: ['c2'] }));
    expect(included.settingBodyIds).toEqual(['c2']);
  });

  it('플롯 메모는 그 회차 것만 들어간다', () => {
    const input = baseInput({
      episodes: [ep(4, { plotMemo: '4화 메모' })],
      currentEpisode: { id: 'e5', order: 5, title: 't', bodyText: '', plotMemo: '5화 메모' },
    });
    const { text } = assembleContext(input);
    expect(text).toContain('5화 메모');
    expect(text).not.toContain('4화 메모');
    expect(assembleContext(baseInput()).included.hasPlotMemo).toBe(false);
  });

  it('직전 N개 회차는 전문, 그 이전은 요약, 이후 회차와 현재 회차는 제외한다', () => {
    const input = baseInput({ episodes: [ep(1), ep(2), ep(3), ep(4), ep(5), ep(6)] });
    const { text, included } = assembleContext(input);
    expect(included.fullEpisodeIds).toEqual(['e3', 'e4']);
    expect(included.summaryEpisodeIds).toEqual(['e1', 'e2']);
    expect(text).toContain('3화 전문');
    expect(text).toContain('1화 요약');
    expect(text).not.toContain('1화 전문');
    expect(text).not.toContain('3화 요약');
    expect(text).not.toContain('6화');
    expect(text).not.toContain('5화 전문');
  });

  it('recentEpisodeCount를 바꾸면 전문 개수가 달라진다', () => {
    const input = baseInput({ episodes: [ep(2), ep(3), ep(4)], recentEpisodeCount: 1 });
    expect(assembleContext(input).included.fullEpisodeIds).toEqual(['e4']);
  });

  it('사이드 패널 대화는 입력으로 받아도 포함하지 않는다', () => {
    const { text } = assembleContext(baseInput({ sidePanelChat: [{ role: 'user', text: '폐기된 아이디어XYZ' }] }));
    expect(text).not.toContain('폐기된 아이디어XYZ');
  });

  it('자료는 고정되었거나 제목·태그가 언급된 것의 제목·요약만 들어가고 인용·URL은 빠진다', () => {
    const resources = [
      resource('r1', '조선 관직'),
      resource('r2', '도검 종류', { tags: ['환도'] }),
      resource('r3', '의학 상식'),
      resource('r4', '경찰서 구조'),
    ];
    const input = baseInput({
      resources,
      pinnedResourceIds: ['r4'],
      currentEpisode: { id: 'e5', order: 5, title: 't', bodyText: '조선 관직 체계를 따랐다.', plotMemo: '환도를 뽑는다' },
    });
    const { text, included } = assembleContext(input);
    expect(included.resourceIds).toEqual(['r4', 'r1', 'r2']);
    expect(text).toContain('조선 관직 요약');
    expect(text).not.toContain('의학 상식');
    expect(text).not.toContain('비밀 인용문');
    expect(text).not.toContain('example.com');
  });

  it('자료는 토큰 상한을 넘기면 들어가지 않는다', () => {
    const input = baseInput({ resources: [resource('r1', '자료'), resource('r2', '자료2')], pinnedResourceIds: ['r1', 'r2'], resourceTokenBudget: 1 });
    expect(assembleContext(input).included.resourceIds).toEqual([]);
  });

  it('같은 입력은 항상 같은 결과를 낸다', () => {
    const input = baseInput({ settings: [character('c1', '이운')], episodes: [ep(3), ep(4)] });
    expect(assembleContext(input)).toEqual(assembleContext(input));
  });
});
