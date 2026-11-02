import { FakeImageProvider, type ImageProvider } from '@muse-pen/image-engine';
import { FakeTextProvider } from '@muse-pen/story-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { character, createTestApi, createWork, makeClient, type TestApi } from './test-utils';

let t: TestApi;
const gates: (() => void)[] = [];
// 멈춰 있는 공급자를 풀어 줘야 워커가 끝나고 정리할 수 있다.
afterEach(async () => {
  gates.splice(0).forEach((release) => release());
  await t?.cleanup();
});

// 호출이 끝나는 시점을 테스트가 쥘 수 있는 이미지 공급자
function gatedProvider() {
  const inner = new FakeImageProvider();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let fail = false;
  const provider: ImageProvider = {
    async generate(req) {
      await gate;
      if (fail) throw new Error('공급자 오류: 검열 차단');
      return inner.generate(req);
    },
  };
  return { provider, release, setFail: (v: boolean) => (fail = v) };
}

async function setup(options = {}) {
  t = createTestApi(options);
  const a = (await t.signUp('a@x.com')).client;
  const w = await createWork(a);
  const s = (await a.json('POST', `/api/works/${w.id}/settings`, character('하린'))).body;
  return { a, w, s };
}

describe('[AC-13] 작업 테이블과 워커', () => {
  it('대기 → 실행중 → 완료로 전이한다', async () => {
    const g = gatedProvider();
    gates.push(g.release);
    const { a, w, s } = await setup({ imageProvider: g.provider });
    const created = await a.json('POST', `/api/works/${w.id}/settings/${s.id}/images`, { quality: 'draft' });
    expect(created.status).toBe(202);
    expect(created.body.status).toBe('pending');
    await new Promise((r) => setTimeout(r, 30));
    expect((await a.json('GET', `/api/jobs/${created.body.id}`)).body.status).toBe('running');
    g.release();
    await t.api.whenJobsIdle();
    const done = (await a.json('GET', `/api/jobs/${created.body.id}`)).body;
    expect(done).toMatchObject({ status: 'completed', error: null, kind: 'image_generation', targetId: s.id });
    expect(done.result.imageId).toBeTruthy();
  });

  it('공급자 오류는 실패로 기록하고, 실패한 작업만 재요청할 수 있다', async () => {
    const g = gatedProvider();
    g.setFail(true);
    gates.push(g.release);
    const { a, w, s } = await setup({ imageProvider: g.provider });
    const job = (await a.json('POST', `/api/works/${w.id}/settings/${s.id}/images`, {})).body;
    expect((await a.json('POST', `/api/jobs/${job.id}/retry`)).status).toBe(409); // 아직 실패가 아니다
    g.release();
    await t.api.whenJobsIdle();
    const failed = (await a.json('GET', `/api/jobs/${job.id}`)).body;
    expect(failed).toMatchObject({ status: 'failed', error: '공급자 오류: 검열 차단' });
    expect((await a.json('GET', `/api/works/${w.id}/settings/${s.id}/images`)).body).toEqual([]);

    g.setFail(false);
    const retried = await a.json('POST', `/api/jobs/${job.id}/retry`);
    expect(retried.status).toBe(200);
    expect(retried.body.status).not.toBe('failed');
    await t.api.whenJobsIdle();
    expect((await a.json('GET', `/api/jobs/${job.id}`)).body.status).toBe('completed');
    expect((await a.json('POST', `/api/jobs/${job.id}/retry`)).status).toBe(409); // 완료된 작업은 재요청 불가
  });

  it('api를 재시작해도 작업 기록이 남고, 실행중이던 작업은 이어서 처리한다', async () => {
    const g = gatedProvider(); // 풀지 않아 실행중에 멈춰 있다(정리 단계에서 푼다)
    gates.push(g.release);
    const { a, w, s } = await setup({ imageProvider: g.provider, startWorker: true });
    const done = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화' })).body;
    const completion = (await a.json('POST', `/api/works/${w.id}/episodes/${done.id}/complete`)).body;
    const image = (await a.json('POST', `/api/works/${w.id}/settings/${s.id}/images`, {})).body;
    await new Promise((r) => setTimeout(r, 30));
    expect((await a.json('GET', `/api/jobs/${completion.id}`)).body.status).toBe('completed');
    expect((await a.json('GET', `/api/jobs/${image.id}`)).body.status).toBe('running');

    // 같은 DB 파일로 새 인스턴스를 띄운다(프로세스 재시작). 이전 인스턴스는 SQLite 파일 접근만 닫는다.
    const { dbPath, imageDir, dir } = t;
    const cookie = a.cookie;
    const second = createTestApi({ authSecret: 'test-secret-test-secret-test-secret-1234' }, dir);
    void dbPath; void imageDir;
    const a2 = makeClient(second.api, cookie);
    expect((await a2.json('GET', `/api/jobs/${completion.id}`)).body.status).toBe('completed'); // 기록 유지(같은 세션 쿠키도 유효)
    await second.api.whenJobsIdle();
    const resumed = (await a2.json('GET', `/api/jobs/${image.id}`)).body;
    expect(resumed.status).toBe('completed'); // running → pending 복구 후 새 워커가 처리
    await second.api.close();
  });
});

describe('회차 완료 처리 작업', () => {
  it('요약을 저장하고 필드 변경은 AI 제안으로 저장한다. 수락해야 반영된다', async () => {
    const provider = new FakeTextProvider((req) => {
      if (req.task !== 'episode_completion') return '';
      return JSON.stringify({ summary: '하린이 죽는다', fieldChanges: [{ settingId: SETTING_ID.id, field: 'status', to: 'dead', reason: '사망 장면' }, { settingId: SETTING_ID.id, field: 'nope', to: 1, reason: '버려진다' }] });
    });
    const SETTING_ID = { id: '' };
    const { a, w, s } = await setup({ textProvider: provider });
    SETTING_ID.id = s.id;
    const e = (await a.json('POST', `/api/works/${w.id}/episodes`, { title: '1화' })).body;
    const base = `/api/works/${w.id}/episodes/${e.id}`;
    const job = (await a.json('POST', `${base}/complete`)).body;
    await t.api.whenJobsIdle();
    expect((await a.json('GET', `/api/jobs/${job.id}`)).body).toMatchObject({ status: 'completed', result: { summary: '하린이 죽는다', fieldChangeCount: 1 } });
    expect((await a.json('GET', base)).body.completed).toBe(true);
    expect((await a.json('GET', `${base}/summary`)).body).toEqual({ content: '하린이 죽는다', aiGenerated: true });

    const changes = (await a.json('GET', `${base}/field-changes`)).body;
    expect(changes).toHaveLength(1);
    expect((await a.json('GET', `/api/works/${w.id}/settings/${s.id}`)).body.status).toBe('alive'); // 아직 반영 전
    const accepted = await a.json('POST', `/api/works/${w.id}/field-changes/${changes[0].id}/accept`);
    expect(accepted.body.setting.status).toBe('dead');
    expect((await a.json('POST', `/api/works/${w.id}/field-changes/${changes[0].id}/accept`)).status).toBe(409);

    // 작가가 요약을 고치면 AI 생성 표시가 사라진다
    expect((await a.json('PUT', `${base}/summary`, { content: '고침' })).body).toEqual({ content: '고침', aiGenerated: false });
    // 사용 기록 1건(회차 완료)
    expect((await a.json('GET', '/api/usage')).body.map((u: any) => u.feature)).toEqual(['episode_completion']);
  });
});
