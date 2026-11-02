import { settingKindSchema, type Setting, type SettingKind, type Work } from '@muse-pen/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { KIND_LABEL, SettingForm } from '../components/SettingForm';

const KINDS = settingKindSchema.options;

function SettingsPanel({ workId, kind }: { workId: string; kind: SettingKind }) {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [characters, setCharacters] = useState<Setting[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSettings(await api.listSettings(workId, kind));
      if (kind === 'prop') setCharacters(await api.listSettings(workId, 'character'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    }
  }, [workId, kind]);

  useEffect(() => {
    setSettings(null);
    void load();
  }, [load]);

  return (
    <section role="tabpanel" aria-label={KIND_LABEL[kind]}>
      <SettingForm
        kind={kind}
        characters={characters}
        onSubmit={async (fields) => {
          await api.createSetting(workId, fields);
          await load();
        }}
      />
      {error && <p role="alert" className="error">{error}</p>}
      <h3>{KIND_LABEL[kind]} 목록</h3>
      {settings?.length === 0 && <p className="muted">등록된 {KIND_LABEL[kind]}이(가) 없습니다.</p>}
      <ul className="card-list" aria-label={`${KIND_LABEL[kind]} 목록`}>
        {settings?.map((s) => <li key={s.id}>{s.name}</li>)}
      </ul>
    </section>
  );
}

export function WorkDetailPage() {
  const { workId = '' } = useParams();
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<SettingKind>('character');

  useEffect(() => {
    api.getWork(workId).then(setWork, (e: Error) => setError(e.message));
  }, [workId]);

  if (error) return <p role="alert" className="error">{error}</p>;
  if (!work) return <p className="muted">불러오는 중…</p>;

  return (
    <>
      <p><Link to="/">← 작품 목록</Link></p>
      <h1>{work.title}</h1>
      <p className="muted">
        {work.concept.genre} · {work.concept.tone} · {work.concept.pointOfView === 'first_person' ? '1인칭' : '3인칭'} · {work.concept.targetReader}
      </p>
      <h2>회차</h2>
      <p className="muted">회차 에디터는 준비 중입니다.</p>
      <h2>설정</h2>
      <div role="tablist" aria-label="설정 종류" className="tabs">
        {KINDS.map((k) => (
          <button key={k} role="tab" type="button" aria-selected={k === kind} className={k === kind ? '' : 'secondary'} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <SettingsPanel key={kind} workId={work.id} kind={kind} />
    </>
  );
}
