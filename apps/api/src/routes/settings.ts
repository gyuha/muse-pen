import { settingFieldsSchema, settingKindSchema, type Id, type Setting, type SettingFields } from '@muse-pen/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { type Ctx, type Env, HttpError, notFound, ownedSetting, ownedWork, svc, unprocessable, validate } from '../http';

export const settingsRoutes = new Hono<Env>();

const querySchema = z.object({ kind: settingKindSchema.optional() });
const looseBody = z.record(z.string(), z.unknown());

// 설정 본문을 제외한 정형 필드 부분
function fieldsOf(setting: Setting): Record<string, unknown> {
  const { id: _i, workId: _w, bodyJson: _j, bodyText: _t, bodyMarkdown: _m, createdAt: _c, updatedAt: _u, ...fields } = setting;
  return fields;
}

// 정형 필드는 종류별로 고정이다. 정의되지 않은 필드·잘못된 상태 값은 거부한다.
function parseFields(raw: Record<string, unknown>): SettingFields {
  const parsed = settingFieldsSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, `설정 필드가 올바르지 않다: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  return parsed.data;
}

// 참조 검사: 소품 소유자는 같은 작품의 캐릭터, 대표 이미지는 그 설정의 이미지여야 한다.
export function checkReferences(c: Ctx, workId: Id, fields: SettingFields, settingId: Id | null): void {
  const { repo } = svc(c);
  if (fields.kind === 'prop' && fields.ownerCharacterId) {
    const owner = repo.getSetting(workId, fields.ownerCharacterId);
    if (owner?.kind !== 'character') throw unprocessable('소품 소유자는 같은 작품의 캐릭터여야 한다');
  }
  if (fields.kind !== 'world' && fields.representativeImageId) {
    const image = settingId ? repo.getImage(fields.representativeImageId) : null;
    if (!image || image.workId !== workId || image.targetType !== 'setting' || image.targetId !== settingId) {
      throw unprocessable('대표 이미지는 이 설정에 속한 이미지여야 한다');
    }
  }
}

settingsRoutes.get('/works/:workId/settings', validate('query', querySchema), (c) =>
  c.json(svc(c).repo.listSettings(ownedWork(c).id, c.req.valid('query').kind)),
);

// 요청 본문 = 정형 필드(kind 포함) + 선택적 bodyJson(설정 본문 블록 JSON)
settingsRoutes.post('/works/:workId/settings', validate('json', looseBody), (c) => {
  const work = ownedWork(c);
  const { bodyJson, ...raw } = c.req.valid('json');
  const fields = parseFields(raw);
  checkReferences(c, work.id, fields, null);
  const { repo, deriver } = svc(c);
  return c.json(repo.createSetting(work.id, fields, { ...deriver.derive(bodyJson), bodyJson: bodyJson ?? null }), 201);
});

settingsRoutes.get('/works/:workId/settings/:settingId', (c) => c.json(ownedSetting(c).setting));

settingsRoutes.patch('/works/:workId/settings/:settingId', validate('json', looseBody), (c) => {
  const { work, setting } = ownedSetting(c);
  const { bodyJson, ...patch } = c.req.valid('json');
  if ('kind' in patch && patch.kind !== setting.kind) throw new HttpError(400, '설정 종류는 바꿀 수 없다');
  const fields = parseFields({ ...fieldsOf(setting), ...patch });
  checkReferences(c, work.id, fields, setting.id);
  const { repo, deriver } = svc(c);
  const body = 'bodyJson' in c.req.valid('json') ? { ...deriver.derive(bodyJson), bodyJson: bodyJson ?? null } : undefined;
  return c.json(repo.updateSetting(work.id, setting.id, { fields, body }));
});

settingsRoutes.delete('/works/:workId/settings/:settingId', async (c) => {
  const { work, setting } = ownedSetting(c);
  const { repo, storage } = svc(c);
  const keys = repo.deleteSetting(work.id, setting.id);
  await Promise.all(keys.map((k) => storage.delete(k).catch(() => undefined)));
  return c.body(null, 204);
});

// --- 필드 변경 제안(회차 완료 처리 결과). 수락한 것만 정형 필드에 반영된다. ---
settingsRoutes.get('/works/:workId/episodes/:episodeId/field-changes', (c) => {
  const work = ownedWork(c);
  const episode = svc(c).repo.getEpisode(work.id, c.req.param('episodeId'));
  if (!episode) throw notFound();
  return c.json(svc(c).repo.listFieldChanges(work.id, episode.id));
});

settingsRoutes.post('/works/:workId/field-changes/:changeId/:action{accept|reject}', (c) => {
  const work = ownedWork(c);
  const { repo } = svc(c);
  const change = repo.getFieldChange(work.id, c.req.param('changeId'));
  if (!change) throw notFound();
  if (change.status !== 'pending') throw new HttpError(409, '이미 처리된 제안이다');
  if (c.req.param('action') === 'reject') {
    repo.setFieldChangeStatus(change.id, 'rejected');
    return c.json({ ...change, status: 'rejected' });
  }
  const setting = repo.getSetting(work.id, change.settingId);
  if (!setting) throw notFound();
  const fields = parseFields({ ...fieldsOf(setting), [change.field]: change.to });
  checkReferences(c, work.id, fields, setting.id);
  const updated = repo.transaction((tx) => {
    tx.setFieldChangeStatus(change.id, 'accepted');
    return tx.updateSetting(work.id, setting.id, { fields });
  });
  return c.json({ change: { ...change, status: 'accepted' }, setting: updated });
});
