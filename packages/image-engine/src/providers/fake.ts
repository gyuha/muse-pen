import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import type { ImageProvider, ImageProviderRequest, ImageProviderResult } from '../index';

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

/** Offline 1x1 RGB PNG, deterministically colored by every input byte. */
export class FakeImageProvider implements ImageProvider {
  async generate(request: ImageProviderRequest): Promise<ImageProviderResult> {
    const hash = createHash('sha256');
    hash.update(JSON.stringify([request.modelId, request.prompt, request.referenceImages.map((image) => [image.contentType, image.data.length])]));
    for (const image of request.referenceImages) hash.update(image.data);
    const digest = hash.digest();
    const header = Buffer.alloc(13);
    header.writeUInt32BE(1, 0);
    header.writeUInt32BE(1, 4);
    header[8] = 8;
    header[9] = 2;
    const data = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(Buffer.from([0, digest[0]!, digest[1]!, digest[2]!]))),
      chunk('IEND', new Uint8Array()),
    ]);
    return { data, contentType: 'image/png', modelId: request.modelId, usage: { unit: 'images', count: 1 }, estimatedCostUsd: 0 };
  }
}
