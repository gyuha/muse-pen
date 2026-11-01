import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { admin } from 'better-auth/plugins';
import { ulid } from 'ulid';
import type { Db } from './db/client';
import * as schema from './db/schema';

export interface AuthOptions {
  db: Db;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  // 초대 코드를 원자적으로 선점한다. 없음·이미 사용됨이면 false.
  claimInvite(code: string): boolean;
  // 가입이 끝난 계정을 초대 코드에 연결한다.
  attachInvite(code: string, authorId: string): void;
}

// 이메일+비밀번호 로그인, 쿠키 세션, 관리자 역할은 better-auth가 맡는다.
// 가입은 초대 코드가 있어야만 가능하다(공개 가입 없음). 비밀번호 재설정은 관리자가 admin 플러그인으로 한다.
export function createAuth(options: AuthOptions) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(options.db, { provider: 'sqlite', schema }),
    emailAndPassword: { enabled: true, autoSignIn: false },
    user: {
      additionalFields: {
        inviteCode: { type: 'string', required: false, input: true },
      },
    },
    plugins: [admin()],
    advanced: { database: { generateId: () => ulid() } },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const code = (user as { inviteCode?: string | null }).inviteCode;
            if (!code || !options.claimInvite(code)) {
              // 403을 던지면 better-auth가 중복 가입으로 보고 200을 돌려주므로 400을 쓴다.
              throw new APIError('BAD_REQUEST', { message: '유효하지 않거나 이미 사용된 초대 코드입니다.' });
            }
            return { data: user };
          },
          after: async (user) => {
            const code = (user as { inviteCode?: string | null }).inviteCode;
            if (code) options.attachInvite(code, user.id);
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
