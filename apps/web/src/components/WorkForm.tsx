import { createWorkInputSchema, type CreateWorkInput, type PointOfView } from '@muse-pen/shared';
import { useState } from 'react';
import { useSubmit } from './useSubmit';

export function WorkForm({ onSubmit }: { onSubmit(input: CreateWorkInput): Promise<void> | void }) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [tone, setTone] = useState('');
  const [pointOfView, setPointOfView] = useState<PointOfView>('third_person');
  const [targetReader, setTargetReader] = useState('');
  const [artStyle, setArtStyle] = useState('');

  const form = useSubmit(async () => {
    const parsed = createWorkInputSchema.safeParse({
      title: title.trim(),
      concept: {
        genre: genre.trim(),
        tone: tone.trim(),
        pointOfView,
        targetReader: targetReader.trim(),
        // 작품 생성 시점에는 화풍 레퍼런스 이미지가 없다.
        artStylePreset: { prompt: artStyle.trim(), referenceImageIds: [] },
      },
    });
    if (!parsed.success) throw new Error('제목, 장르, 톤, 타깃 독자, 화풍 프리셋 문구를 모두 입력해 주세요.');
    await onSubmit(parsed.data);
  });

  return (
    <form onSubmit={form.onSubmit} aria-label="작품 생성">
      <label>
        제목
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        장르
        <input value={genre} onChange={(e) => setGenre(e.target.value)} />
      </label>
      <label>
        톤
        <input value={tone} onChange={(e) => setTone(e.target.value)} />
      </label>
      <label>
        서술 시점
        <select value={pointOfView} onChange={(e) => setPointOfView(e.target.value as PointOfView)}>
          <option value="first_person">1인칭</option>
          <option value="third_person">3인칭</option>
        </select>
      </label>
      <label>
        타깃 독자
        <input value={targetReader} onChange={(e) => setTargetReader(e.target.value)} />
      </label>
      <label>
        화풍 프리셋 문구
        <textarea rows={2} value={artStyle} onChange={(e) => setArtStyle(e.target.value)} />
      </label>
      {form.error && <p role="alert" className="error">{form.error}</p>}
      <button type="submit" disabled={form.pending}>작품 만들기</button>
    </form>
  );
}
