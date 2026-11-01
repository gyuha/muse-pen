// 이미지 파일은 DB가 아니라 이 인터페이스 뒤에 둔다. 첫 구현은 로컬 디스크(apps/api).
export interface StoredImage {
  data: Uint8Array;
  contentType: string;
}

export interface ImageStorage {
  save(key: string, image: StoredImage): Promise<void>;
  read(key: string): Promise<StoredImage>;
  delete(key: string): Promise<void>;
  // 로컬 디스크는 api 경로를, S3 호환 저장소는 서명 URL을 돌려준다.
  getAccessUrl(key: string): Promise<string>;
}
