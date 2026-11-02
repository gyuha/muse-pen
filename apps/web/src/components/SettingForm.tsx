import { settingFieldsSchema, type CharacterStatus, type Setting, type SettingFields, type SettingKind } from '@muse-pen/shared';
import { useState } from 'react';
import { useSubmit } from './useSubmit';

export const KIND_LABEL: Record<SettingKind, string> = { character: '캐릭터', location: '장소', prop: '소품', world: '세계관' };

const STATUS_LABEL: Record<CharacterStatus, string> = { alive: '생존', dead: '사망', missing: '행방불명' };

// 키워드 필드는 쉼표로 구분한 한 줄 입력으로 받는다.
const toList = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean);

interface Props {
  kind: SettingKind;
  // 소품 소유자 선택지(같은 작품의 캐릭터)
  characters?: Setting[];
  onSubmit(fields: SettingFields): Promise<void> | void;
}

export function SettingForm({ kind, characters = [], onSubmit }: Props) {
  const [v, setV] = useState({
    name: '',
    aliases: '',
    gender: '',
    ageGroup: '',
    appearanceKeywords: '',
    status: 'alive' as CharacterStatus,
    placeType: '',
    eraMoodKeywords: '',
    ownerCharacterId: '',
    rulesSummary: '',
  });
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [key]: e.target.value }));

  const form = useSubmit(async () => {
    const raw = {
      character: { kind, name: v.name.trim(), aliases: toList(v.aliases), gender: v.gender.trim(), ageGroup: v.ageGroup.trim(), appearanceKeywords: toList(v.appearanceKeywords), status: v.status, representativeImageId: null },
      location: { kind, name: v.name.trim(), placeType: v.placeType.trim(), eraMoodKeywords: toList(v.eraMoodKeywords), representativeImageId: null },
      prop: { kind, name: v.name.trim(), ownerCharacterId: v.ownerCharacterId || null, appearanceKeywords: toList(v.appearanceKeywords), representativeImageId: null },
      world: { kind, name: v.name.trim(), rulesSummary: v.rulesSummary.trim() },
    }[kind];
    const parsed = settingFieldsSchema.safeParse(raw);
    if (!parsed.success) throw new Error('이름을 입력해 주세요.');
    await onSubmit(parsed.data);
    setV((cur) => ({ ...cur, name: '', aliases: '', gender: '', ageGroup: '', appearanceKeywords: '', placeType: '', eraMoodKeywords: '', rulesSummary: '' }));
  });

  return (
    <form onSubmit={form.onSubmit} aria-label={`${KIND_LABEL[kind]} 생성`}>
      <label>
        이름
        <input value={v.name} onChange={set('name')} />
      </label>
      {kind === 'character' && (
        <>
          <label>
            별칭(쉼표로 구분)
            <input value={v.aliases} onChange={set('aliases')} />
          </label>
          <label>
            성별
            <input value={v.gender} onChange={set('gender')} />
          </label>
          <label>
            연령대
            <input value={v.ageGroup} onChange={set('ageGroup')} />
          </label>
          <label>
            외형 키워드(쉼표로 구분)
            <input value={v.appearanceKeywords} onChange={set('appearanceKeywords')} />
          </label>
          <label>
            상태
            <select value={v.status} onChange={set('status')}>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {kind === 'location' && (
        <>
          <label>
            장소 유형
            <input value={v.placeType} onChange={set('placeType')} />
          </label>
          <label>
            시대·분위기 키워드(쉼표로 구분)
            <input value={v.eraMoodKeywords} onChange={set('eraMoodKeywords')} />
          </label>
        </>
      )}
      {kind === 'prop' && (
        <>
          <label>
            소유 캐릭터
            <select value={v.ownerCharacterId} onChange={set('ownerCharacterId')}>
              <option value="">소유자 없음</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            외형 키워드(쉼표로 구분)
            <input value={v.appearanceKeywords} onChange={set('appearanceKeywords')} />
          </label>
        </>
      )}
      {kind === 'world' && (
        <label>
          규칙 요약
          <textarea rows={3} value={v.rulesSummary} onChange={set('rulesSummary')} />
        </label>
      )}
      {form.error && <p role="alert" className="error">{form.error}</p>}
      <button type="submit" disabled={form.pending}>{KIND_LABEL[kind]} 만들기</button>
    </form>
  );
}
