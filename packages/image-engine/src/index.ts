import { artStylePresetSchema, imageRecordSchema } from '@muse-pen/shared';
import type { AiUsageRecord, ArtStylePreset, ImageRecord, ImageStorage, Setting, SettingFields, StoredImage } from '@muse-pen/shared';

// Logical model identifiers; a real adapter must map these to verified provider IDs.
export const DRAFT_IMAGE_MODEL_ID = 'nano-banana-2.1';
export const FINAL_IMAGE_MODEL_ID = 'nano-banana-pro';
export type ImageQuality = 'draft' | 'final';
export type ImageUsage = Pick<AiUsageRecord, 'modelId' | 'usage' | 'estimatedCostUsd'>;
export interface ImageProviderRequest {
  prompt: string;
  referenceImages: readonly StoredImage[];
  modelId: string;
}
export interface ImageProviderResult extends StoredImage {
  modelId: string;
  usage: { unit: 'images'; count: number };
  estimatedCostUsd: number;
}
export interface ImageProvider {
  generate(request: ImageProviderRequest): Promise<ImageProviderResult>;
}

/** Array order is author-defined (e.g. hair, eyes, build, outfit); never sort it. */
export function buildImagePrompt(fields: SettingFields, style: Pick<ArtStylePreset, 'prompt'>): string {
  const prefix = style.prompt;
  switch (fields.kind) {
    case 'character': return `${prefix}\nCharacter: ${fields.name}\nGender: ${fields.gender}\nAge group: ${fields.ageGroup}\nAppearance keywords: ${JSON.stringify(fields.appearanceKeywords)}`;
    case 'location': return `${prefix}\nLocation: ${fields.name}\nPlace type: ${fields.placeType}\nEra and mood keywords: ${JSON.stringify(fields.eraMoodKeywords)}`;
    case 'prop': return `${prefix}\nProp: ${fields.name}\nAppearance keywords: ${JSON.stringify(fields.appearanceKeywords)}`;
    case 'world': throw new Error('World settings do not support image generation');
  }
}

export interface GenerateImageRequest {
  setting: Setting;
  artStyle: ArtStylePreset;
  /** Only approved reference records, resolved by the backend within the work. */
  referenceRecords: readonly ImageRecord[];
  quality: ImageQuality;
  direction?: string;
  imageId: string;
  storageKey: string;
  createdAt: string;
}
export interface ImageEngineDependencies {
  provider: ImageProvider;
  storage: ImageStorage;
  /** Backend adds author, usage ID and timestamp and persists one record per call. */
  onUsage: (usage: ImageUsage) => void | Promise<void>;
}
export interface GeneratedImage {
  record: ImageRecord;
  mode: 'candidate' | 'reference';
  prompt: string;
}

export async function generateImage(request: GenerateImageRequest, deps: ImageEngineDependencies): Promise<GeneratedImage> {
  const { setting } = request;
  const basePrompt = buildImagePrompt(setting, request.artStyle); // rejects world before any IO
  const prompt = request.direction === undefined ? basePrompt : `${basePrompt}\n${request.direction}`;
  if (setting.kind === 'world') throw new Error('World settings do not support image generation');
  const style = artStylePresetSchema.parse(request.artStyle);
  if (request.quality !== 'draft' && request.quality !== 'final') throw new Error('Invalid image quality');
  const modelId = request.quality === 'draft' ? DRAFT_IMAGE_MODEL_ID : FINAL_IMAGE_MODEL_ID;
  const record = imageRecordSchema.parse({
    id: request.imageId, workId: setting.workId, targetType: 'setting', targetId: setting.id,
    storageKey: request.storageKey, isRepresentative: false, modelId, createdAt: request.createdAt,
  });
  const ids = [...(setting.representativeImageId ? [setting.representativeImageId] : []), ...style.referenceImageIds];
  const references = ids.map((id, index) => {
    const image = request.referenceRecords.find((item) => item.id === id && item.workId === setting.workId);
    const representative = !!setting.representativeImageId && index === 0;
    if (!image || (representative
      ? image.targetType !== 'setting' || image.targetId !== setting.id || !image.isRepresentative
      : image.targetType !== 'art_style' || image.targetId !== setting.workId)) {
      throw new Error(`Missing or invalid approved image reference: ${id}`);
    }
    if (image.storageKey === request.storageKey) throw new Error('Output must not overwrite an input reference');
    return image;
  });
  const referenceImages = await Promise.all(references.map((image) => deps.storage.read(image.storageKey)));
  const result = await deps.provider.generate({ prompt, referenceImages, modelId });
  await deps.onUsage({ modelId: result.modelId, usage: result.usage, estimatedCostUsd: result.estimatedCostUsd });
  const generatedRecord = imageRecordSchema.parse({ ...record, modelId: result.modelId });
  await deps.storage.save(record.storageKey, { data: result.data, contentType: result.contentType });
  return { record: generatedRecord, mode: setting.representativeImageId ? 'reference' : 'candidate', prompt };
}

export { FakeImageProvider } from './providers/fake';
export { GeminiImageProvider, ImageSafetyBlockedError, ImageNoImageError } from './providers/gemini';
