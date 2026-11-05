import { describe, expect, it, vi } from 'vitest';
import type { ImageRecord, ImageStorage, Setting, StoredImage } from '@muse-pen/shared';
import { buildImagePrompt, DRAFT_IMAGE_MODEL_ID, FINAL_IMAGE_MODEL_ID, FakeImageProvider, generateImage } from './index';

const setting: Setting = {
  kind: 'character', id: 'character', workId: 'work', name: '하린', aliases: [], gender: '여성', ageGroup: '성인',
  appearanceKeywords: ['흑발', '푸른 눈', '장신', '흰 코트'], status: 'alive', representativeImageId: 'approved',
  bodyJson: [], bodyText: 'ignored', bodyMarkdown: '', createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
};
const style = { prompt: '수채화', referenceImageIds: ['style'] };
function record(id: string, targetType: 'setting' | 'art_style', targetId: string): ImageRecord {
  return { id, targetType, targetId, workId: 'work', storageKey: id, modelId: 'original', isRepresentative: id === 'approved', createdAt: setting.createdAt };
}
function fixture() {
  const files = new Map<string, StoredImage>(['approved', 'style', 'previous'].map((key) => [key, { data: new TextEncoder().encode(key), contentType: 'image/png' }]));
  const storage: ImageStorage = {
    save: vi.fn(async (key, image) => { files.set(key, image); }),
    read: vi.fn(async (key) => { const image = files.get(key); if (!image) throw new Error('missing'); return image; }),
    delete: vi.fn(async (key) => { files.delete(key); }), getAccessUrl: vi.fn(async (key) => key),
  };
  const provider = new FakeImageProvider();
  const generate = vi.spyOn(provider, 'generate');
  const onUsage = vi.fn();
  const request = { setting, artStyle: style, referenceRecords: [record('approved', 'setting', 'character'), record('style', 'art_style', 'work'), record('previous', 'setting', 'character')], quality: 'draft' as const, imageId: 'output', storageKey: 'output', createdAt: setting.createdAt };
  return { files, storage, provider, generate, onUsage, request };
}

describe('image engine', () => {
  it('assembles exact deterministic prompts with style first and ordered structured fields', () => {
    expect(buildImagePrompt(setting, style)).toBe('수채화\nCharacter: 하린\nGender: 여성\nAge group: 성인\nAppearance keywords: ["흑발","푸른 눈","장신","흰 코트"]');
    expect(buildImagePrompt({ ...setting, bodyText: 'changed' } as Setting, style)).toBe(buildImagePrompt(setting, style));
    expect(buildImagePrompt({ kind: 'location', name: '궁전', placeType: '왕궁', eraMoodKeywords: ['중세', '어두움'], representativeImageId: null }, style)).toBe('수채화\nLocation: 궁전\nPlace type: 왕궁\nEra and mood keywords: ["중세","어두움"]');
    expect(buildImagePrompt({ kind: 'prop', name: '검', ownerCharacterId: null, appearanceKeywords: ['은빛'], representativeImageId: null }, style)).toBe('수채화\nProp: 검\nAppearance keywords: ["은빛"]');
  });
  it('reads only approved representative and style, never chains generated outputs; saves through storage', async () => {
    const f = fixture();
    const result = await generateImage(f.request, f);
    await generateImage({ ...f.request, imageId: 'next', storageKey: 'next', referenceRecords: [...f.request.referenceRecords, result.record] }, f);
    expect(f.storage.read).toHaveBeenNthCalledWith(1, 'approved');
    expect(f.storage.read).toHaveBeenNthCalledWith(2, 'style');
    expect(f.storage.read).toHaveBeenNthCalledWith(3, 'approved');
    expect(f.storage.read).toHaveBeenNthCalledWith(4, 'style');
    expect(f.generate.mock.calls[0]![0].referenceImages).toEqual([f.files.get('approved'), f.files.get('style')]);
    expect(result.mode).toBe('reference');
    expect(result.record.isRepresentative).toBe(false);
    expect(f.storage.save).toHaveBeenCalledTimes(2);
    expect(f.files.get('output')?.contentType).toBe('image/png');
    expect(result.record.modelId).toBe(DRAFT_IMAGE_MODEL_ID);
    expect(f.onUsage).toHaveBeenCalledTimes(2);
    expect(f.onUsage).toHaveBeenCalledWith({ modelId: DRAFT_IMAGE_MODEL_ID, usage: { unit: 'images', count: 1 }, estimatedCostUsd: 0 });
  });
  it('supports candidate generation and records the final model', async () => {
    const f = fixture();
    const result = await generateImage({ ...f.request, quality: 'final', setting: { ...setting, representativeImageId: null } as Setting }, f);
    expect(result.mode).toBe('candidate');
    expect(result.record.modelId).toBe(FINAL_IMAGE_MODEL_ID);
    expect(f.storage.read).toHaveBeenCalledExactlyOnceWith('style');
  });
  it('rejects world generation before provider or storage calls', async () => {
    const f = fixture();
    await expect(generateImage({ ...f.request, setting: { ...setting, kind: 'world', rulesSummary: '규칙' } as Setting }, f)).rejects.toThrow('World');
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.storage.read).not.toHaveBeenCalled();
    expect(f.storage.save).not.toHaveBeenCalled();
  });
  it('rejects missing, unapproved or foreign references rather than substituting previous output', async () => {
    for (const change of [{ isRepresentative: false }, { workId: 'other' }, { targetId: 'other' }]) {
      const f = fixture();
      f.request.referenceRecords[0] = { ...f.request.referenceRecords[0]!, ...change };
      await expect(generateImage(f.request, f)).rejects.toThrow('reference');
      expect(f.generate).not.toHaveBeenCalled();
    }
  });
  it('reports usage even when persistence fails', async () => {
    const f = fixture();
    vi.mocked(f.storage.save).mockRejectedValue(new Error('disk full'));
    await expect(generateImage(f.request, f)).rejects.toThrow('disk full');
    expect(f.onUsage).toHaveBeenCalledTimes(1);
  });
  it('fake provider emits a deterministic PNG affected by prompt and reference bytes', async () => {
    const provider = new FakeImageProvider();
    const input = { modelId: DRAFT_IMAGE_MODEL_ID, prompt: 'same', referenceImages: [] };
    const first = await provider.generate(input);
    expect(first.data).toEqual((await provider.generate(input)).data);
    expect(Array.from(first.data.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(first.data).not.toEqual((await provider.generate({ ...input, prompt: 'different' })).data);
    expect(first.data).not.toEqual((await provider.generate({ ...input, referenceImages: [{ contentType: 'image/png', data: new Uint8Array([1]) }] })).data);
  });
});

it('direction appends a separate line after the unchanged base prompt', async () => {
  const f = fixture();
  const result = await generateImage({ ...f.request, direction: '정면 미소' }, f);
  expect(result.prompt).toBe(`${buildImagePrompt(setting, style)}\n정면 미소`);
  expect(f.generate.mock.calls[0]![0].prompt).toBe(result.prompt);
});
it('without direction preserves the existing prompt byte for byte', async () => {
  const f = fixture();
  const result = await generateImage(f.request, f);
  expect(Buffer.from(result.prompt)).toEqual(Buffer.from(buildImagePrompt(setting, style)));
});
