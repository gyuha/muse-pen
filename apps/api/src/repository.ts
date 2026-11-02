import type {
  AiUsageRecord, Concept, Episode, Id, ImageRecord, Job, JobKind, JobStatus, Resource, Setting, SettingFields, Source, Work,
} from '@muse-pen/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import * as t from './db/schema';
import type { DerivedBody } from './derive';
import { newId, nowIso } from './util';

// DB 접근은 이 계층으로만 한다. 라우트·워커·엔진 연결 코드는 직접 쿼리하지 않는다.
// 소유권은 호출하는 쪽이 getOwnedWork로 먼저 확인하고, 그 뒤 자식 자원은 workId로 범위를 좁혀 조회한다.

const json = (value: unknown): string => JSON.stringify(value ?? null);
const parse = <T>(value: string): T => JSON.parse(value) as T;

type Body = DerivedBody & { bodyJson: unknown };
const bodyColumns = (b: Body) => ({ bodyJson: json(b.bodyJson), bodyText: b.text, bodyMarkdown: b.markdown });

export interface FieldChange {
  id: Id; workId: Id; episodeId: Id; settingId: Id; field: string; from: unknown; to: unknown; reason: string;
  status: 'pending' | 'accepted' | 'rejected'; createdAt: string; updatedAt: string;
}

export class Repository {
  constructor(private readonly db: Db) {}

  transaction<R>(fn: (repo: Repository) => R): R {
    return this.db.transaction((tx) => fn(new Repository(tx as unknown as Db)));
  }

  // --- 작가 ---
  getAuthor(id: Id) {
    return this.db.select().from(t.user).where(eq(t.user.id, id)).get() ?? null;
  }
  findAuthorByEmail(email: string) {
    return this.db.select().from(t.user).where(eq(t.user.email, email.toLowerCase())).get() ?? null;
  }
  listAuthors() {
    return this.db.select({ id: t.user.id, email: t.user.email, name: t.user.name, role: t.user.role, createdAt: t.user.createdAt }).from(t.user).orderBy(asc(t.user.createdAt)).all();
  }
  setAuthorRole(id: Id, role: 'admin' | 'user'): void {
    this.db.update(t.user).set({ role }).where(eq(t.user.id, id)).run();
  }

  // --- 초대 코드 ---
  createInvite(code: string, createdAt = nowIso()) {
    const row = { id: newId(), code, createdAt, usedByAuthorId: null, usedAt: null };
    this.db.insert(t.inviteCodes).values(row).run();
    return row;
  }
  listInvites() {
    return this.db.select().from(t.inviteCodes).orderBy(desc(t.inviteCodes.createdAt)).all();
  }
  // 사용되지 않은 코드만 한 문장으로 선점한다(동시 가입 경쟁 방지).
  claimInvite(code: string): boolean {
    const result = this.db.update(t.inviteCodes).set({ usedAt: nowIso() })
      .where(and(eq(t.inviteCodes.code, code), sql`${t.inviteCodes.usedAt} is null`)).run();
    return result.changes === 1;
  }
  attachInvite(code: string, authorId: Id): void {
    this.db.update(t.inviteCodes).set({ usedByAuthorId: authorId }).where(eq(t.inviteCodes.code, code)).run();
  }

  // --- 작품 ---
  private toWork(r: typeof t.works.$inferSelect): Work {
    return {
      id: r.id, authorId: r.authorId, title: r.title,
      concept: {
        genre: r.genre, tone: r.tone, pointOfView: r.pointOfView as Concept['pointOfView'], targetReader: r.targetReader,
        artStylePreset: { prompt: r.artStylePrompt, referenceImageIds: parse<Id[]>(r.artStyleReferenceImageIds) },
      },
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }
  private workColumns(title: string, c: Concept) {
    return {
      title, genre: c.genre, tone: c.tone, pointOfView: c.pointOfView, targetReader: c.targetReader,
      artStylePrompt: c.artStylePreset.prompt, artStyleReferenceImageIds: json(c.artStylePreset.referenceImageIds),
    };
  }
  createWork(authorId: Id, title: string, concept: Concept): Work {
    const now = nowIso();
    const row = { id: newId(), authorId, ...this.workColumns(title, concept), createdAt: now, updatedAt: now };
    this.db.insert(t.works).values(row).run();
    return this.toWork(row);
  }
  getOwnedWork(authorId: Id, workId: Id): Work | null {
    const r = this.db.select().from(t.works).where(and(eq(t.works.id, workId), eq(t.works.authorId, authorId))).get();
    return r ? this.toWork(r) : null;
  }
  listWorks(authorId: Id): Work[] {
    return this.db.select().from(t.works).where(eq(t.works.authorId, authorId)).orderBy(desc(t.works.createdAt), desc(t.works.id)).all().map((r) => this.toWork(r));
  }
  updateWork(workId: Id, title: string, concept: Concept): Work {
    this.db.update(t.works).set({ ...this.workColumns(title, concept), updatedAt: nowIso() }).where(eq(t.works.id, workId)).run();
    return this.toWork(this.db.select().from(t.works).where(eq(t.works.id, workId)).get()!);
  }
  // 작품과 딸린 행은 FK cascade로 지워진다. 이미지 파일은 호출자가 반환된 키로 지운다.
  deleteWork(workId: Id): string[] {
    const keys = this.db.select({ k: t.images.storageKey }).from(t.images).where(eq(t.images.workId, workId)).all().map((r) => r.k);
    this.db.delete(t.works).where(eq(t.works.id, workId)).run();
    return keys;
  }

  // --- 시놉시스·플롯 메모·회차 요약 ---
  getSynopsis(workId: Id): string {
    return this.db.select().from(t.synopses).where(eq(t.synopses.workId, workId)).get()?.content ?? '';
  }
  putSynopsis(workId: Id, content: string): void {
    const updatedAt = nowIso();
    this.db.insert(t.synopses).values({ workId, content, updatedAt }).onConflictDoUpdate({ target: t.synopses.workId, set: { content, updatedAt } }).run();
  }
  getPlotMemo(episodeId: Id): string {
    return this.db.select().from(t.plotMemos).where(eq(t.plotMemos.episodeId, episodeId)).get()?.content ?? '';
  }
  putPlotMemo(episodeId: Id, content: string): void {
    const updatedAt = nowIso();
    this.db.insert(t.plotMemos).values({ episodeId, content, updatedAt }).onConflictDoUpdate({ target: t.plotMemos.episodeId, set: { content, updatedAt } }).run();
  }
  getSummary(episodeId: Id): { content: string; aiGenerated: boolean } | null {
    const r = this.db.select().from(t.episodeSummaries).where(eq(t.episodeSummaries.episodeId, episodeId)).get();
    return r ? { content: r.content, aiGenerated: r.aiGenerated } : null;
  }
  putSummary(episodeId: Id, content: string, aiGenerated: boolean): void {
    const updatedAt = nowIso();
    this.db.insert(t.episodeSummaries).values({ episodeId, content, aiGenerated, updatedAt })
      .onConflictDoUpdate({ target: t.episodeSummaries.episodeId, set: { content, aiGenerated, updatedAt } }).run();
  }

  // --- 회차 ---
  private toEpisode(r: typeof t.episodes.$inferSelect): Episode {
    return {
      id: r.id, workId: r.workId, order: r.position, title: r.title, bodyJson: parse(r.bodyJson),
      bodyText: r.bodyText, bodyMarkdown: r.bodyMarkdown, completed: r.completed, createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }
  listEpisodes(workId: Id): Episode[] {
    return this.db.select().from(t.episodes).where(eq(t.episodes.workId, workId)).orderBy(asc(t.episodes.position)).all().map((r) => this.toEpisode(r));
  }
  getEpisode(workId: Id, id: Id): Episode | null {
    const r = this.db.select().from(t.episodes).where(and(eq(t.episodes.id, id), eq(t.episodes.workId, workId))).get();
    return r ? this.toEpisode(r) : null;
  }
  // 회차 순서는 1..n 연속값으로 유지한다. order를 주면 그 자리에 끼워 넣는다.
  createEpisode(workId: Id, input: { title: string; body: Body; order?: number }): Episode {
    return this.transaction((repo) => {
      const ids = repo.listEpisodes(workId).map((e) => e.id);
      const id = newId();
      const now = nowIso();
      repo.db.insert(t.episodes).values({ id, workId, position: ids.length + 1, title: input.title, ...bodyColumns(input.body), completed: false, createdAt: now, updatedAt: now }).run();
      repo.resequence(workId, id, input.order);
      return repo.getEpisode(workId, id)!;
    });
  }
  private resequence(workId: Id, movedId: Id | null, targetOrder?: number): void {
    const ids = this.db.select({ id: t.episodes.id }).from(t.episodes).where(eq(t.episodes.workId, workId)).orderBy(asc(t.episodes.position), asc(t.episodes.createdAt)).all().map((r) => r.id);
    if (movedId && targetOrder !== undefined) {
      ids.splice(ids.indexOf(movedId), 1);
      ids.splice(Math.min(Math.max(targetOrder, 1), ids.length + 1) - 1, 0, movedId);
    }
    ids.forEach((id, i) => this.db.update(t.episodes).set({ position: i + 1 }).where(eq(t.episodes.id, id)).run());
  }
  updateEpisode(workId: Id, id: Id, patch: { title?: string; body?: Body; completed?: boolean; order?: number }): Episode {
    return this.transaction((repo) => {
      const set: Partial<typeof t.episodes.$inferInsert> = { updatedAt: nowIso() };
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.body) Object.assign(set, bodyColumns(patch.body));
      if (patch.completed !== undefined) set.completed = patch.completed;
      repo.db.update(t.episodes).set(set).where(eq(t.episodes.id, id)).run();
      if (patch.order !== undefined) repo.resequence(workId, id, patch.order);
      return repo.getEpisode(workId, id)!;
    });
  }
  deleteEpisode(workId: Id, id: Id): void {
    this.transaction((repo) => {
      repo.db.delete(t.episodes).where(eq(t.episodes.id, id)).run();
      repo.resequence(workId, null);
    });
  }

  // --- 회차 스냅샷 ---
  createSnapshot(episode: Episode) {
    const row = { id: newId(), episodeId: episode.id, title: episode.title, bodyJson: json(episode.bodyJson), bodyText: episode.bodyText, bodyMarkdown: episode.bodyMarkdown, createdAt: nowIso() };
    this.db.insert(t.episodeSnapshots).values(row).run();
    return this.toSnapshot(row);
  }
  private toSnapshot(r: typeof t.episodeSnapshots.$inferSelect) {
    return { id: r.id, episodeId: r.episodeId, title: r.title, bodyJson: parse<unknown>(r.bodyJson), bodyText: r.bodyText, bodyMarkdown: r.bodyMarkdown, createdAt: r.createdAt };
  }
  listSnapshots(episodeId: Id) {
    return this.db.select().from(t.episodeSnapshots).where(eq(t.episodeSnapshots.episodeId, episodeId)).orderBy(desc(t.episodeSnapshots.createdAt), desc(t.episodeSnapshots.id)).all().map((r) => this.toSnapshot(r));
  }
  getSnapshot(episodeId: Id, id: Id) {
    const r = this.db.select().from(t.episodeSnapshots).where(and(eq(t.episodeSnapshots.id, id), eq(t.episodeSnapshots.episodeId, episodeId))).get();
    return r ? this.toSnapshot(r) : null;
  }

  // --- 설정 ---
  private toSetting(r: typeof t.settings.$inferSelect): Setting {
    return {
      kind: r.kind, name: r.name, ...parse<object>(r.fields), id: r.id, workId: r.workId, bodyJson: parse(r.bodyJson),
      bodyText: r.bodyText, bodyMarkdown: r.bodyMarkdown, createdAt: r.createdAt, updatedAt: r.updatedAt,
    } as Setting;
  }
  private static splitFields(fields: SettingFields) {
    const { kind, name, ...rest } = fields;
    return { kind, name, fields: json(rest) };
  }
  listSettings(workId: Id, kind?: string): Setting[] {
    const where = kind ? and(eq(t.settings.workId, workId), eq(t.settings.kind, kind)) : eq(t.settings.workId, workId);
    return this.db.select().from(t.settings).where(where).orderBy(asc(t.settings.createdAt), asc(t.settings.id)).all().map((r) => this.toSetting(r));
  }
  getSetting(workId: Id, id: Id): Setting | null {
    const r = this.db.select().from(t.settings).where(and(eq(t.settings.id, id), eq(t.settings.workId, workId))).get();
    return r ? this.toSetting(r) : null;
  }
  createSetting(workId: Id, fields: SettingFields, body: Body): Setting {
    const now = nowIso();
    const row = { id: newId(), workId, ...Repository.splitFields(fields), ...bodyColumns(body), createdAt: now, updatedAt: now };
    this.db.insert(t.settings).values(row).run();
    return this.toSetting(row);
  }
  updateSetting(workId: Id, id: Id, patch: { fields?: SettingFields; body?: Body }): Setting {
    const set: Partial<typeof t.settings.$inferInsert> = { updatedAt: nowIso() };
    if (patch.fields) Object.assign(set, Repository.splitFields(patch.fields));
    if (patch.body) Object.assign(set, bodyColumns(patch.body));
    this.db.update(t.settings).set(set).where(eq(t.settings.id, id)).run();
    return this.getSetting(workId, id)!;
  }
  // 캐릭터를 지우면 그 캐릭터를 소유자로 가진 소품의 소유자는 비운다. 설정의 이미지 기록은 함께 지우고 파일 키를 돌려준다.
  deleteSetting(workId: Id, id: Id): string[] {
    return this.transaction((repo) => {
      const setting = repo.getSetting(workId, id);
      if (setting?.kind === 'character') {
        for (const prop of repo.listSettings(workId, 'prop')) {
          if (prop.kind === 'prop' && prop.ownerCharacterId === id) {
            const { id: _i, workId: _w, bodyJson: _j, bodyText: _t, bodyMarkdown: _m, createdAt: _c, updatedAt: _u, ...fields } = prop;
            repo.updateSetting(workId, prop.id, { fields: { ...fields, ownerCharacterId: null } });
          }
        }
      }
      const keys = repo.db.select({ k: t.images.storageKey }).from(t.images)
        .where(and(eq(t.images.targetType, 'setting'), eq(t.images.targetId, id))).all().map((r) => r.k);
      repo.db.delete(t.images).where(and(eq(t.images.targetType, 'setting'), eq(t.images.targetId, id))).run();
      repo.db.delete(t.settings).where(eq(t.settings.id, id)).run();
      return keys;
    });
  }

  // --- 고정 설정·고정 자료 ---
  getPinnedSettingIds(episodeId: Id): Id[] {
    return this.db.select().from(t.pinnedSettings).where(eq(t.pinnedSettings.episodeId, episodeId)).all().map((r) => r.settingId);
  }
  setPinnedSettings(episodeId: Id, ids: Id[]): void {
    this.transaction((repo) => {
      repo.db.delete(t.pinnedSettings).where(eq(t.pinnedSettings.episodeId, episodeId)).run();
      for (const settingId of new Set(ids)) repo.db.insert(t.pinnedSettings).values({ episodeId, settingId }).run();
    });
  }
  getPinnedResourceIds(episodeId: Id): Id[] {
    return this.db.select().from(t.pinnedResources).where(eq(t.pinnedResources.episodeId, episodeId)).all().map((r) => r.resourceId);
  }
  setPinnedResources(episodeId: Id, ids: Id[]): void {
    this.transaction((repo) => {
      repo.db.delete(t.pinnedResources).where(eq(t.pinnedResources.episodeId, episodeId)).run();
      for (const resourceId of new Set(ids)) repo.db.insert(t.pinnedResources).values({ episodeId, resourceId }).run();
    });
  }

  // --- 자료 ---
  private toResource(r: typeof t.resources.$inferSelect): Resource {
    return {
      id: r.id, workId: r.workId, title: r.title, question: r.question, summary: r.summary, unverified: r.unverified,
      sources: parse<Source[]>(r.sources), tags: parse<string[]>(r.tags), createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }
  listResources(workId: Id): Resource[] {
    return this.db.select().from(t.resources).where(eq(t.resources.workId, workId)).orderBy(asc(t.resources.createdAt), asc(t.resources.id)).all().map((r) => this.toResource(r));
  }
  getResource(workId: Id, id: Id): Resource | null {
    const r = this.db.select().from(t.resources).where(and(eq(t.resources.id, id), eq(t.resources.workId, workId))).get();
    return r ? this.toResource(r) : null;
  }
  createResource(workId: Id, v: Pick<Resource, 'title' | 'question' | 'summary' | 'unverified' | 'sources' | 'tags'>): Resource {
    const now = nowIso();
    const row = { id: newId(), workId, ...v, sources: json(v.sources), tags: json(v.tags), createdAt: now, updatedAt: now };
    this.db.insert(t.resources).values(row).run();
    return this.toResource(row);
  }
  updateResource(workId: Id, id: Id, v: Pick<Resource, 'title' | 'question' | 'summary' | 'unverified' | 'sources' | 'tags'>): Resource {
    this.db.update(t.resources).set({ ...v, sources: json(v.sources), tags: json(v.tags), updatedAt: nowIso() }).where(eq(t.resources.id, id)).run();
    return this.getResource(workId, id)!;
  }
  deleteResource(id: Id): void {
    this.db.delete(t.resources).where(eq(t.resources.id, id)).run();
  }

  // --- 이미지 ---
  private toImage(r: typeof t.images.$inferSelect): ImageRecord {
    return { id: r.id, workId: r.workId, targetType: r.targetType as ImageRecord['targetType'], targetId: r.targetId, storageKey: r.storageKey, isRepresentative: r.isRepresentative, modelId: r.modelId, createdAt: r.createdAt };
  }
  insertImage(record: ImageRecord): void {
    this.db.insert(t.images).values(record).run();
  }
  getImage(id: Id): ImageRecord | null {
    const r = this.db.select().from(t.images).where(eq(t.images.id, id)).get();
    return r ? this.toImage(r) : null;
  }
  getImageByKey(storageKey: string): ImageRecord | null {
    const r = this.db.select().from(t.images).where(eq(t.images.storageKey, storageKey)).get();
    return r ? this.toImage(r) : null;
  }
  listImages(workId: Id, target?: { targetType: string; targetId: Id }): ImageRecord[] {
    const where = target
      ? and(eq(t.images.workId, workId), eq(t.images.targetType, target.targetType), eq(t.images.targetId, target.targetId))
      : eq(t.images.workId, workId);
    return this.db.select().from(t.images).where(where).orderBy(desc(t.images.createdAt), desc(t.images.id)).all().map((r) => this.toImage(r));
  }
  listImagesByIds(workId: Id, ids: Id[]): ImageRecord[] {
    if (ids.length === 0) return [];
    return this.db.select().from(t.images).where(and(eq(t.images.workId, workId), inArray(t.images.id, ids))).all().map((r) => this.toImage(r));
  }
  deleteImage(id: Id): void {
    this.db.delete(t.images).where(eq(t.images.id, id)).run();
  }
  // 승인: 설정의 대표 이미지를 이 이미지로 바꾼다(이전 대표는 해제).
  approveImage(setting: Setting, image: ImageRecord): Setting {
    return this.transaction((repo) => {
      repo.db.update(t.images).set({ isRepresentative: false }).where(and(eq(t.images.targetType, 'setting'), eq(t.images.targetId, setting.id))).run();
      repo.db.update(t.images).set({ isRepresentative: true }).where(eq(t.images.id, image.id)).run();
      const { id: _i, workId, bodyJson: _j, bodyText: _t, bodyMarkdown: _m, createdAt: _c, updatedAt: _u, ...fields } = setting;
      return repo.updateSetting(workId, setting.id, { fields: { ...fields, representativeImageId: image.id } as SettingFields });
    });
  }

  // --- 작업 ---
  private toJob(r: typeof t.jobs.$inferSelect): Job {
    return {
      id: r.id, authorId: r.authorId, workId: r.workId, kind: r.kind as JobKind, status: r.status as JobStatus, targetId: r.targetId,
      result: r.result === null ? null : parse(r.result), error: r.error, createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }
  createJob(v: { authorId: Id; workId: Id; kind: JobKind; targetId: Id; payload: unknown }): Job {
    const now = nowIso();
    const row = { id: newId(), authorId: v.authorId, workId: v.workId, kind: v.kind, status: 'pending', targetId: v.targetId, payload: json(v.payload), result: null, error: null, attempts: 0, createdAt: now, updatedAt: now };
    this.db.insert(t.jobs).values(row).run();
    return this.toJob(row);
  }
  getJob(id: Id): Job | null {
    const r = this.db.select().from(t.jobs).where(eq(t.jobs.id, id)).get();
    return r ? this.toJob(r) : null;
  }
  getJobPayload<P>(id: Id): P {
    return parse<P>(this.db.select({ p: t.jobs.payload }).from(t.jobs).where(eq(t.jobs.id, id)).get()!.p);
  }
  listJobs(workId: Id): Job[] {
    return this.db.select().from(t.jobs).where(eq(t.jobs.workId, workId)).orderBy(desc(t.jobs.createdAt), desc(t.jobs.id)).all().map((r) => this.toJob(r));
  }
  // 가장 오래된 대기 작업 하나를 실행중으로 바꿔 돌려준다.
  claimNextJob(): Job | null {
    return this.transaction((repo) => {
      const next = repo.db.select().from(t.jobs).where(eq(t.jobs.status, 'pending')).orderBy(asc(t.jobs.createdAt), asc(t.jobs.id)).limit(1).get();
      if (!next) return null;
      repo.db.update(t.jobs).set({ status: 'running', attempts: next.attempts + 1, updatedAt: nowIso() }).where(eq(t.jobs.id, next.id)).run();
      return repo.getJob(next.id);
    });
  }
  finishJob(id: Id, outcome: { result: unknown } | { error: string }): void {
    const set = 'error' in outcome ? { status: 'failed', error: outcome.error, result: null } : { status: 'completed', error: null, result: json(outcome.result) };
    this.db.update(t.jobs).set({ ...set, updatedAt: nowIso() }).where(eq(t.jobs.id, id)).run();
  }
  // 실패한 작업만 다시 대기로 돌린다.
  requeueJob(id: Id): boolean {
    const r = this.db.update(t.jobs).set({ status: 'pending', error: null, updatedAt: nowIso() }).where(and(eq(t.jobs.id, id), eq(t.jobs.status, 'failed'))).run();
    return r.changes === 1;
  }
  // 프로세스가 죽어 실행중으로 남은 작업을 대기로 되돌린다(재시작 복구).
  requeueRunningJobs(): number {
    return this.db.update(t.jobs).set({ status: 'pending', updatedAt: nowIso() }).where(eq(t.jobs.status, 'running')).run().changes;
  }

  // --- AI 사용 기록 ---
  insertUsage(rec: AiUsageRecord): void {
    const u = rec.usage;
    this.db.insert(t.aiUsage).values({
      id: rec.id, authorId: rec.authorId, feature: rec.feature, modelId: rec.modelId, unit: u.unit,
      inputTokens: u.unit === 'tokens' ? u.inputTokens : null, outputTokens: u.unit === 'tokens' ? u.outputTokens : null,
      count: u.unit === 'tokens' ? null : u.count, estimatedCostUsd: rec.estimatedCostUsd, createdAt: rec.createdAt,
    }).run();
  }
  listUsage(authorId?: Id): AiUsageRecord[] {
    const q = this.db.select().from(t.aiUsage);
    const rows = (authorId ? q.where(eq(t.aiUsage.authorId, authorId)) : q).orderBy(asc(t.aiUsage.createdAt), asc(t.aiUsage.id)).all();
    return rows.map((r) => ({
      id: r.id, authorId: r.authorId, feature: r.feature as AiUsageRecord['feature'], modelId: r.modelId,
      usage: r.unit === 'tokens' ? { unit: 'tokens', inputTokens: r.inputTokens ?? 0, outputTokens: r.outputTokens ?? 0 } : { unit: r.unit as 'images' | 'searches', count: r.count ?? 0 },
      estimatedCostUsd: r.estimatedCostUsd, createdAt: r.createdAt,
    }));
  }

  // --- 사이드 패널 대화(저장만 한다. AI 컨텍스트에는 넣지 않는다) ---
  addSideMessage(workId: Id, role: 'user' | 'assistant', content: string) {
    const row = { id: newId(), workId, role, content, createdAt: nowIso() };
    this.db.insert(t.sidePanelMessages).values(row).run();
    return row;
  }
  listSideMessages(workId: Id) {
    return this.db.select().from(t.sidePanelMessages).where(eq(t.sidePanelMessages.workId, workId)).orderBy(asc(t.sidePanelMessages.createdAt), asc(t.sidePanelMessages.id)).all();
  }

  // --- 필드 변경 제안 ---
  private toFieldChange(r: typeof t.fieldChangeSuggestions.$inferSelect): FieldChange {
    return { id: r.id, workId: r.workId, episodeId: r.episodeId, settingId: r.settingId, field: r.field, from: parse(r.fromValue), to: parse(r.toValue), reason: r.reason, status: r.status as FieldChange['status'], createdAt: r.createdAt, updatedAt: r.updatedAt };
  }
  addFieldChanges(workId: Id, episodeId: Id, changes: { settingId: Id; field: string; from: unknown; to: unknown; reason: string }[]): void {
    const now = nowIso();
    // 같은 회차를 다시 완료 처리하면 아직 판단하지 않은 이전 제안은 새 제안으로 대체한다.
    this.db.delete(t.fieldChangeSuggestions).where(and(eq(t.fieldChangeSuggestions.episodeId, episodeId), eq(t.fieldChangeSuggestions.status, 'pending'))).run();
    for (const c of changes) {
      this.db.insert(t.fieldChangeSuggestions).values({ id: newId(), workId, episodeId, settingId: c.settingId, field: c.field, fromValue: json(c.from), toValue: json(c.to), reason: c.reason, status: 'pending', createdAt: now, updatedAt: now }).run();
    }
  }
  listFieldChanges(workId: Id, episodeId: Id): FieldChange[] {
    return this.db.select().from(t.fieldChangeSuggestions).where(and(eq(t.fieldChangeSuggestions.workId, workId), eq(t.fieldChangeSuggestions.episodeId, episodeId))).orderBy(asc(t.fieldChangeSuggestions.createdAt), asc(t.fieldChangeSuggestions.id)).all().map((r) => this.toFieldChange(r));
  }
  getFieldChange(workId: Id, id: Id): FieldChange | null {
    const r = this.db.select().from(t.fieldChangeSuggestions).where(and(eq(t.fieldChangeSuggestions.id, id), eq(t.fieldChangeSuggestions.workId, workId))).get();
    return r ? this.toFieldChange(r) : null;
  }
  setFieldChangeStatus(id: Id, status: 'accepted' | 'rejected'): void {
    this.db.update(t.fieldChangeSuggestions).set({ status, updatedAt: nowIso() }).where(eq(t.fieldChangeSuggestions.id, id)).run();
  }
}
