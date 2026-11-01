import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { ImageStorage, StoredImage } from '@muse-pen/shared';

// 키는 'workId/imageId' 같은 경로 조각만 허용한다(.., 절대 경로, 빈 조각 거부).
const KEY_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

// 로컬 디스크 구현. 파일 옆 `.type` 파일에 content type을 둔다. 이미지는 api가 권한을 확인한 뒤에만 내려준다.
export class LocalDiskImageStorage implements ImageStorage {
  private readonly root: string;

  constructor(
    dir: string,
    private readonly urlPrefix = '/api/image-files',
  ) {
    this.root = resolve(dir);
  }

  private pathOf(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error(`잘못된 이미지 키: ${key}`);
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + sep)) throw new Error(`잘못된 이미지 키: ${key}`);
    return path;
  }

  async save(key: string, image: StoredImage): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, image.data);
    await writeFile(`${path}.type`, image.contentType);
  }

  async read(key: string): Promise<StoredImage> {
    const path = this.pathOf(key);
    const [data, contentType] = await Promise.all([readFile(path), readFile(`${path}.type`, 'utf8')]);
    return { data: new Uint8Array(data), contentType };
  }

  async delete(key: string): Promise<void> {
    const path = this.pathOf(key);
    await Promise.all([rm(path, { force: true }), rm(`${path}.type`, { force: true })]);
  }

  // 정적 경로가 아니라 api 경로다. S3 호환 저장소로 옮기면 이 자리에서 서명 URL을 발급한다.
  async getAccessUrl(key: string): Promise<string> {
    this.pathOf(key);
    return `${this.urlPrefix}/${key}`;
  }
}
