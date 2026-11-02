import type { Concept, Episode, Setting, Work } from '@muse-pen/shared';
import { hc } from 'hono/client';
import { describe, expectTypeOf, it } from 'vitest';
import type { AppType } from './index';

// 컴파일 타임 테스트: web이 hc<AppType>으로 호출할 때 응답·요청 타입이 shared 도메인 타입과 맞는지 확인한다.
// (vitest typecheck 모드가 아니라 `tsc`가 이 파일을 검사한다. 런타임에는 호출하지 않는다.)
describe('Hono RPC 타입(AppType)', () => {
  it('주요 라우트를 타입 안전하게 부른다', () => {
    const typed = () => {
      const client = hc<AppType>('/');

      return async () => {
        const works = await (await client.api.works.$get()).json();
        expectTypeOf(works).toEqualTypeOf<Work[]>();

        const created = await client.api.works.$post({ json: { title: 't', concept: {} as Concept } });
        if (created.status === 201) expectTypeOf((await created.json()).concept).toEqualTypeOf<Concept>();

        const episodes = await (await client.api.works[':workId'].episodes.$get({ param: { workId: 'w' } })).json();
        // bodyJson은 unknown이라 JSON 직렬화 타입에서 정확 비교가 안 되므로 나머지 필드로 확인한다.
        expectTypeOf(episodes[0]!.order).toEqualTypeOf<Episode['order']>();
        expectTypeOf(episodes[0]!.completed).toEqualTypeOf<boolean>();

        const settings = await (await client.api.works[':workId'].settings.$get({ param: { workId: 'w' }, query: {} })).json();
        // 검증 실패(400) 응답이 유니온에 들어 있어 배열로 좁힌 뒤 확인한다.
        if (Array.isArray(settings)) expectTypeOf(settings[0]!.kind).toEqualTypeOf<Setting['kind']>();

        const me = await (await client.api.me.$get()).json();
        expectTypeOf(me.role).toEqualTypeOf<string>();

        // @ts-expect-error 없는 경로는 타입 오류다
        client.api.nope.$get();
      };
    };
    expectTypeOf(typed).toBeFunction();
  });
});
