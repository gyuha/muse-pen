import { expect, it, vi } from 'vitest';
import { FinishReason, BlockedReason, GenerateContentResponse } from '@google/genai';
import { GeminiImageProvider, ImageSafetyBlockedError, ImageNoImageError } from './gemini';

it.each([
  ['nano-banana-2.1', 'gemini-nano-banana-2.1', 0.0336],
  ['nano-banana-pro', 'gemini-3-pro-image', 0.134],
])('gemini maps %s, references, image usage and cost', async (logical, actual, price) => {
  const response = new GenerateContentResponse();
  response.candidates = [{ finishReason: FinishReason.STOP, content: { parts: [{ inlineData: { data: 'AQID', mimeType: 'image/png' } }] } }];
  const generateContent = vi.fn().mockResolvedValue(response);
  const provider = new GeminiImageProvider({ client: { models: { generateContent } } });
  const referenceImages = [1, 2].map(n => ({ data: new Uint8Array([n]), contentType: 'image/png' }));
  expect(await provider.generate({ modelId: logical as string, prompt: 'draw', referenceImages })).toEqual({
    data: Buffer.from([1, 2, 3]), contentType: 'image/png', modelId: actual,
    usage: { unit: 'images', count: 1 }, estimatedCostUsd: price,
  });
  expect(generateContent).toHaveBeenCalledExactlyOnceWith({ model: actual,
    contents: [{ role: 'user', parts: [{ text: 'draw' }, { inlineData: { mimeType: 'image/png', data: 'AQ==' } }, { inlineData: { mimeType: 'image/png', data: 'Ag==' } }] }],
    config: { responseModalities: ['IMAGE'], imageConfig: { imageSize: '1K' }, httpOptions: { retryOptions: { attempts: 1 } } },
  });
});
it.each(['prompt', 'candidate'])('gemini maps %s safety blocks with reason and no retry', async source => {
  const response = new GenerateContentResponse();
  if (source === 'prompt') response.promptFeedback = { blockReason: BlockedReason.SAFETY, blockReasonMessage: 'blocked input' };
  else response.candidates = [{ finishReason: FinishReason.IMAGE_SAFETY, finishMessage: 'blocked output' }];
  const generateContent = vi.fn().mockResolvedValue(response);
  const provider = new GeminiImageProvider({ client: { models: { generateContent } } });
  const error = await provider.generate({ modelId: 'nano-banana-pro', prompt: 'draw', referenceImages: [] }).catch(e => e);
  expect(error).toBeInstanceOf(ImageSafetyBlockedError);
  expect(error.reason).toContain(source === 'prompt' ? 'blocked input' : 'blocked output');
  expect(error.modelId).toBe('gemini-3-pro-image');
  expect(generateContent).toHaveBeenCalledTimes(1);
});

it('gemini preserves text-only response context in a dedicated no-image error', async () => {
  const response = new GenerateContentResponse();
  response.candidates = [{ finishReason: FinishReason.STOP, content: { parts: [{ text: '거절 사유: ' }, { text: '가'.repeat(250) }] } }];
  const generateContent = vi.fn().mockResolvedValue(response);
  const provider = new GeminiImageProvider({ client: { models: { generateContent } } });
  const error = await provider.generate({ modelId: 'nano-banana-pro', prompt: 'draw', referenceImages: [] }).catch(e => e);
  expect(error).toBeInstanceOf(ImageNoImageError);
  expect(error.text).toBe(('거절 사유: ' + '가'.repeat(250)).slice(0, 200));
  expect(error.finishReason).toBe('STOP');
  expect(error.message).toContain(error.text);
  expect(error.message).toContain('STOP');
  expect(error.modelId).toBe('gemini-3-pro-image');
  expect(generateContent).toHaveBeenCalledTimes(1);
});
