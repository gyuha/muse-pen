import type { Work } from '@muse-pen/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api';
import { WorkForm } from '../components/WorkForm';

export function WorksPage() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listWorks().then(setWorks, (e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <h1>내 작품</h1>
      <p><Link to="/works/new">새 작품 만들기</Link></p>
      {error && <p role="alert" className="error">{error}</p>}
      {works?.length === 0 && <p className="muted">아직 작품이 없습니다.</p>}
      <ul className="card-list" aria-label="작품 목록">
        {works?.map((work) => (
          <li key={work.id}>
            <Link to={`/works/${work.id}`}>{work.title}</Link>
            <div className="muted">{work.concept.genre} · {work.concept.tone}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function NewWorkPage() {
  const navigate = useNavigate();
  return (
    <>
      <h1>새 작품</h1>
      <WorkForm
        onSubmit={async (input) => {
          const work = await api.createWork(input);
          void navigate(`/works/${work.id}`);
        }}
      />
    </>
  );
}
