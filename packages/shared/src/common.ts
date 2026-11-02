import { z } from 'zod';

// ID는 문자열 ULID/UUID다(자동 증가 정수 금지). 형식 검증은 저장소 계층이 맡는다.
export const idSchema = z.string().min(1);
export type Id = z.infer<typeof idSchema>;

// 시간 값은 ISO 8601 UTC 문자열 한 가지로 통일한다.
export const timestampSchema = z.iso.datetime();
export type Timestamp = z.infer<typeof timestampSchema>;

// 에디터 블록 JSON은 에디터 라이브러리 확정 전이라 형태를 정하지 않는다.
export const blockJsonSchema = z.unknown();
