// 첨부 파일 준비: 종류·크기 확인, 사진 줄이기, 조각 나누기/합치기.

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Firestore 문서 하나는 1MiB까지라 여유를 두고 자른다 */
export const CHUNK_BYTES = 750_000;
/** 사진은 긴 쪽을 이 픽셀로 줄인다 (프린트 글씨가 읽힐 정도) */
const MAX_IMAGE_SIDE = 2000;
const JPEG_QUALITY = 0.85;

export class AttachError extends Error {}

export function isImage(type: string): boolean {
  return type.startsWith('image/');
}

export function isPdf(type: string, name = ''): boolean {
  return type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 바이트를 조각으로 나눈다 (비어 있는 파일도 한 조각) */
export function splitChunks(bytes: Uint8Array, size = CHUNK_BYTES): Uint8Array[] {
  if (bytes.length === 0) return [bytes];
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.subarray(i, i + size));
  return out;
}

export function joinChunks(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** 첨부할 수 있는 파일인지. 안 되면 이유를 담은 AttachError. */
export function checkFile(file: { type: string; name: string; size: number }): 'image' | 'pdf' {
  if (isImage(file.type)) return 'image';
  if (isPdf(file.type, file.name)) return 'pdf';
  throw new AttachError('사진과 PDF만 붙일 수 있어요.');
}

/** 사진을 줄여서 JPEG로. 줄인 게 더 크거나 읽을 수 없는 형식이면 원본을 쓴다. */
async function shrinkImage(file: File): Promise<Blob> {
  // GIF는 움직임이 사라지니 그대로
  if (file.type === 'image/gif') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  // 투명한 PNG가 검게 나오지 않게 흰 바탕
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', JPEG_QUALITY));
  return blob && blob.size < file.size ? blob : file;
}

/** 올릴 준비: 사진은 줄이고, 5MB를 넘으면 거부한다. */
export async function prepareFile(file: File): Promise<{ blob: Blob; name: string }> {
  const kind = checkFile(file);
  let blob: Blob = file;
  let name = file.name || (kind === 'pdf' ? '문서.pdf' : '사진.jpg');
  if (kind === 'image') {
    blob = await shrinkImage(file);
    if (blob !== file && blob.type === 'image/jpeg') name = name.replace(/\.[^.]+$/, '') + '.jpg';
  }
  if (blob.size > MAX_FILE_BYTES) {
    throw new AttachError(`파일이 너무 커요 (${formatSize(blob.size)}). 5MB까지 붙일 수 있어요.`);
  }
  return { blob, name };
}
