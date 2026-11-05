import { GoogleGenAI } from '@google/genai';
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import type { ImageProvider, ImageProviderRequest, ImageProviderResult } from '../index';

/** Standard 1K image-output prices, verified 2026-11-03: https://aistudio.google.com/docs/pricing */
export const GEMINI_MODELS = {
  'nano-banana-2.1': { id: 'gemini-nano-banana-2.1', price: 0.0336 },
  'nano-banana-pro': { id: 'gemini-3-pro-image', price: 0.134 },
} as const;
export interface GeminiClient {
  models: { generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse> };
}
export class ImageSafetyBlockedError extends Error {
  constructor(public readonly reason: string, public readonly modelId: string) {
    super(`Image safety blocked: ${reason}`);
    this.name = 'ImageSafetyBlockedError';
  }
}
export class ImageNoImageError extends Error {
  constructor(public readonly text: string, public readonly finishReason: string, public readonly modelId: string) {
    super(`Gemini returned no image (${finishReason}): ${text}`);
    this.name = 'ImageNoImageError';
  }
}
const safetyReasons = new Set(['SAFETY', 'IMAGE_SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'IMAGE_PROHIBITED_CONTENT', 'SPII']);

export class GeminiImageProvider implements ImageProvider {
  private readonly client: GeminiClient;
  constructor(options: { apiKey?: string; client?: GeminiClient }) {
    this.client = options.client ?? new GoogleGenAI({ apiKey: options.apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
  }
  async generate(request: ImageProviderRequest): Promise<ImageProviderResult> {
    const model = GEMINI_MODELS[request.modelId as keyof typeof GEMINI_MODELS];
    if (!model) throw new Error(`Unknown Gemini image model: ${request.modelId}`);
    const response = await this.client.models.generateContent({
      model: model.id,
      contents: [{ role: 'user', parts: [
        { text: request.prompt },
        ...request.referenceImages.map(image => ({ inlineData: { mimeType: image.contentType, data: Buffer.from(image.data).toString('base64') } })),
      ] }],
      config: { responseModalities: ['IMAGE'], imageConfig: { imageSize: '1K' }, httpOptions: { retryOptions: { attempts: 1 } } },
    });
    const feedback = response.promptFeedback;
    if (feedback?.blockReason && feedback.blockReason !== 'BLOCKED_REASON_UNSPECIFIED') {
      throw new ImageSafetyBlockedError([feedback.blockReason, feedback.blockReasonMessage].filter(Boolean).join(': '), model.id);
    }
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && safetyReasons.has(candidate.finishReason)) {
      throw new ImageSafetyBlockedError([candidate.finishReason, candidate.finishMessage].filter(Boolean).join(': '), model.id);
    }
    const images = candidate?.content?.parts?.filter(part => part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data);
    const text = candidate?.content?.parts?.filter(part => part.text !== undefined).map(part => part.text).join('');
    if (!images?.length && text !== undefined && candidate?.content?.parts?.some(part => part.text !== undefined)) {
      throw new ImageNoImageError(text.slice(0, 200), candidate.finishReason ?? 'UNKNOWN', model.id);
    }
    if (images?.length !== 1) throw new Error(`Expected one Gemini image, received ${images?.length ?? 0}`);
    const image = images[0]!.inlineData!;
    return { data: Buffer.from(image.data!, 'base64'), contentType: image.mimeType!, modelId: model.id,
      usage: { unit: 'images', count: 1 }, estimatedCostUsd: model.price };
  }
}
