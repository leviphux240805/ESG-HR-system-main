import jsQR from "jsqr";

const MAX_SIDE = 1600;

/** Vùng thử giải mã (tỉ lệ theo ảnh): cả ảnh, rồi góc trên bên phải (vị trí QR trên mặt trước CCCD), rồi nửa trên. */
const REGIONS: [number, number, number, number][] = [
  [0, 0, 1, 1],
  [0.5, 0, 0.5, 0.6],
  [0.55, 0, 0.45, 0.45],
  [0, 0, 1, 0.6],
];

function decodeRegion(source: CanvasImageSource, width: number, height: number, region: number[]): string | null {
  const [rx, ry, rw, rh] = region;
  const sw = width * rw;
  const sh = height * rh;
  // Vùng nhỏ thì phóng to để mã QR đủ điểm ảnh
  const scale = Math.min(2, MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, width * rx, height * ry, sw, sh, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/** Đọc mã QR từ ảnh chụp (trả null nếu không tìm thấy). */
export async function decodeQrFromFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const region of REGIONS) {
      const text = decodeRegion(bitmap, bitmap.width, bitmap.height, region);
      if (text) return text;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

/** Đọc mã QR từ một khung hình video (quét bằng camera). */
export function decodeQrFromVideo(video: HTMLVideoElement): string | null {
  if (!video.videoWidth) return null;
  return decodeRegion(video, video.videoWidth, video.videoHeight, [0, 0, 1, 1]);
}
