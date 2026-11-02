import type { CharacterStatus, Id, Setting } from '@muse-pen/shared';

export interface ConflictWarning {
  settingId: Id;
  name: string;
  matchedText: string;
  status: Exclude<CharacterStatus, 'alive'>;
}

// 자동 경고: 정형 필드 + 문자열 매칭만 쓴다. LLM을 부르지 않으므로 공급자를 받지 않는다.
export function findConflictWarnings(suggestionText: string, settings: Setting[]): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];
  for (const setting of settings) {
    if (setting.kind !== 'character' || setting.status === 'alive') continue;
    const matchedText = [setting.name, ...setting.aliases].find((name) => suggestionText.includes(name));
    if (matchedText) {
      warnings.push({ settingId: setting.id, name: setting.name, matchedText, status: setting.status });
    }
  }
  return warnings;
}
