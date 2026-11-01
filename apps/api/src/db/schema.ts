import { customType, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// 시간 값은 모든 테이블에서 ISO 8601 UTC 문자열 한 가지다. better-auth는 Date를 넘기므로 변환 컬럼을 쓴다.
const isoDate = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => value.toISOString(),
  fromDriver: (value) => new Date(value),
});
const iso = (name: string) => text(name).notNull();

// --- better-auth 테이블(이메일+비밀번호, 세션, 관리자 역할) ---

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
  role: text('role').notNull().default('user'),
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  banReason: text('ban_reason'),
  banExpires: isoDate('ban_expires'),
  inviteCode: text('invite_code'),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: isoDate('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: text('impersonated_by'),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: isoDate('access_token_expires_at'),
  refreshTokenExpiresAt: isoDate('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: isoDate('expires_at').notNull(),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
});

// --- 도메인 테이블 ---
// JSON 값(블록 JSON, 키워드 배열 등)은 text로 저장하고 앱에서 파싱한다. DB의 JSON 함수는 쓰지 않는다.

export const inviteCodes = sqliteTable('invite_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  createdAt: iso('created_at'),
  usedByAuthorId: text('used_by_author_id'),
  usedAt: text('used_at'),
});

export const works = sqliteTable('works', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull().references(() => user.id),
  title: text('title').notNull(),
  genre: text('genre').notNull(),
  tone: text('tone').notNull(),
  pointOfView: text('point_of_view').notNull(),
  targetReader: text('target_reader').notNull(),
  artStylePrompt: text('art_style_prompt').notNull(),
  artStyleReferenceImageIds: text('art_style_reference_image_ids').notNull(),
  createdAt: iso('created_at'),
  updatedAt: iso('updated_at'),
}, (t) => [index('works_author_idx').on(t.authorId)]);

const workRef = () => text('work_id').notNull().references(() => works.id, { onDelete: 'cascade' });

export const synopses = sqliteTable('synopses', {
  workId: text('work_id').primaryKey().references(() => works.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  updatedAt: iso('updated_at'),
});

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  workId: workRef(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  bodyJson: text('body_json').notNull(),
  bodyText: text('body_text').notNull(),
  bodyMarkdown: text('body_markdown').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: iso('created_at'),
  updatedAt: iso('updated_at'),
}, (t) => [index('episodes_work_idx').on(t.workId, t.position)]);

const episodeRef = () => text('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' });

export const plotMemos = sqliteTable('plot_memos', {
  episodeId: text('episode_id').primaryKey().references(() => episodes.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  updatedAt: iso('updated_at'),
});

export const episodeSummaries = sqliteTable('episode_summaries', {
  episodeId: text('episode_id').primaryKey().references(() => episodes.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  aiGenerated: integer('ai_generated', { mode: 'boolean' }).notNull(),
  updatedAt: iso('updated_at'),
});

export const episodeSnapshots = sqliteTable('episode_snapshots', {
  id: text('id').primaryKey(),
  episodeId: episodeRef(),
  title: text('title').notNull(),
  bodyJson: text('body_json').notNull(),
  bodyText: text('body_text').notNull(),
  bodyMarkdown: text('body_markdown').notNull(),
  createdAt: iso('created_at'),
}, (t) => [index('snapshots_episode_idx').on(t.episodeId)]);

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  workId: workRef(),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  // kind·name·body를 뺀 나머지 정형 필드(JSON 문자열)
  fields: text('fields').notNull(),
  bodyJson: text('body_json').notNull(),
  bodyText: text('body_text').notNull(),
  bodyMarkdown: text('body_markdown').notNull(),
  createdAt: iso('created_at'),
  updatedAt: iso('updated_at'),
}, (t) => [index('settings_work_idx').on(t.workId)]);

export const pinnedSettings = sqliteTable('pinned_settings', {
  episodeId: episodeRef(),
  settingId: text('setting_id').notNull().references(() => settings.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.episodeId, t.settingId] })]);

export const resources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  workId: workRef(),
  title: text('title').notNull(),
  question: text('question').notNull(),
  summary: text('summary').notNull(),
  unverified: integer('unverified', { mode: 'boolean' }).notNull(),
  sources: text('sources').notNull(),
  tags: text('tags').notNull(),
  createdAt: iso('created_at'),
  updatedAt: iso('updated_at'),
}, (t) => [index('resources_work_idx').on(t.workId)]);

export const pinnedResources = sqliteTable('pinned_resources', {
  episodeId: episodeRef(),
  resourceId: text('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.episodeId, t.resourceId] })]);

export const images = sqliteTable('images', {
  id: text('id').primaryKey(),
  workId: workRef(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  storageKey: text('storage_key').notNull(),
  isRepresentative: integer('is_representative', { mode: 'boolean' }).notNull(),
  modelId: text('model_id').notNull(),
  createdAt: iso('created_at'),
}, (t) => [uniqueIndex('images_storage_key_idx').on(t.storageKey), index('images_target_idx').on(t.targetType, t.targetId)]);

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull(),
  workId: workRef(),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  targetId: text('target_id').notNull(),
  payload: text('payload').notNull(),
  result: text('result'),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: iso('created_at'),
  updatedAt: iso('updated_at'),
}, (t) => [index('jobs_status_idx').on(t.status, t.createdAt)]);

export const aiUsage = sqliteTable('ai_usage', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull(),
  feature: text('feature').notNull(),
  modelId: text('model_id').notNull(),
  unit: text('unit').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  count: integer('count'),
  estimatedCostUsd: real('estimated_cost_usd').notNull(),
  createdAt: iso('created_at'),
}, (t) => [index('ai_usage_author_idx').on(t.authorId, t.createdAt)]);

export const sidePanelMessages = sqliteTable('side_panel_messages', {
  id: text('id').primaryKey(),
  workId: workRef(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: iso('created_at'),
});

export const fieldChangeSuggestions = sqliteTable('field_change_suggestions', {
  id: text('id').primaryKey(),
  workId: workRef(),
  episodeId: episodeRef(),
  settingId: text('setting_id').notNull().references(() => settings.id, { onDelete: 'cascade' }),
  field: text('field').notNull(),
  fromValue: text('from_value').notNull(),
  toValue: text('to_value').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull(),
  createdAt: iso('created_at'),
  updatedAt: iso('updated_at'),
});
