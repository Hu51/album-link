import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  CACHE_DIR,
  RESOLUTION_MAX_EDGE,
  type DownloadResolution,
} from "./config";
import { assertReadableFile, resolvePhotoPath } from "./paths";

function cacheKey(parts: string[]): string {
  return createHash("sha1").update(parts.join("|")).digest("hex");
}

function watermarkPath(): string {
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "watermark.png",
  );
}

async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const markPath = watermarkPath();
  if (!fs.existsSync(/* turbopackIgnore: true */ markPath)) {
    return imageBuffer;
  }

  const image = sharp(imageBuffer);
  const meta = await image.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width < 32 || height < 32) return imageBuffer;

  const markWidth = Math.max(48, Math.round(width * 0.28));
  const mark = await sharp(/* turbopackIgnore: true */ markPath)
    .resize({ width: markWidth, withoutEnlargement: true })
    .png()
    .toBuffer();
  const markMeta = await sharp(mark).metadata();
  const markH = markMeta.height || markWidth;
  const left = Math.max(0, Math.round((width - (markMeta.width || markWidth)) / 2));
  const top = Math.max(0, Math.round((height - markH) / 2));

  return image
    .composite([{ input: mark, left, top, blend: "over" }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

async function ensureCacheFile(
  key: string,
  ext: string,
  producer: () => Promise<Buffer>,
): Promise<{ filePath: string; buffer: Buffer }> {
  fs.mkdirSync(/* turbopackIgnore: true */ CACHE_DIR, { recursive: true });
  const filePath = path.join(
    /* turbopackIgnore: true */ CACHE_DIR,
    `${key}.${ext}`,
  );
  if (fs.existsSync(/* turbopackIgnore: true */ filePath)) {
    return {
      filePath,
      buffer: fs.readFileSync(/* turbopackIgnore: true */ filePath),
    };
  }
  const buffer = await producer();
  fs.writeFileSync(/* turbopackIgnore: true */ filePath, buffer);
  return { filePath, buffer };
}

export async function getThumbnail(
  relativePath: string,
  watermark = false,
): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const absolute = resolvePhotoPath(relativePath);
  assertReadableFile(absolute);
  const mtime = Math.floor(
    fs.statSync(/* turbopackIgnore: true */ absolute).mtimeMs,
  );
  const key = cacheKey([
    "thumb",
    relativePath,
    String(mtime),
    watermark ? "wm" : "plain",
  ]);
  const { buffer } = await ensureCacheFile(key, "jpg", async () => {
    const resized = await sharp(absolute)
      .rotate()
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return watermark ? applyWatermark(resized) : resized;
  });
  return { buffer, contentType: "image/jpeg" };
}

export async function getMediaFile(
  relativePath: string,
  resolution: DownloadResolution,
  disposition: "inline" | "attachment",
  watermark = false,
): Promise<{
  buffer: Buffer;
  contentType: string;
  filename: string;
  disposition: "inline" | "attachment";
}> {
  const absolute = resolvePhotoPath(relativePath);
  assertReadableFile(absolute);
  const filename = path.basename(absolute);
  const mtime = Math.floor(
    fs.statSync(/* turbopackIgnore: true */ absolute).mtimeMs,
  );
  const maxEdge = RESOLUTION_MAX_EDGE[resolution];

  if (maxEdge === null && !watermark) {
    return {
      buffer: fs.readFileSync(/* turbopackIgnore: true */ absolute),
      contentType: contentTypeFor(filename),
      filename,
      disposition,
    };
  }

  const key = cacheKey([
    "dl",
    relativePath,
    String(mtime),
    resolution,
    watermark ? "wm" : "plain",
  ]);
  const { buffer } = await ensureCacheFile(key, "jpg", async () => {
    const image = sharp(absolute).rotate();
    const meta = await image.metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);
    let out: Buffer;
    if (maxEdge === null || (longest > 0 && longest <= maxEdge)) {
      out = await image.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    } else {
      out = await image
        .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    }
    return watermark ? applyWatermark(out) : out;
  });

  const outName =
    resolution === "full"
      ? `${path.parse(filename).name}${watermark ? "-wm" : ""}.jpg`
      : `${path.parse(filename).name}-${resolution}${watermark ? "-wm" : ""}.jpg`;

  return {
    buffer,
    contentType: "image/jpeg",
    filename: outName,
    disposition,
  };
}

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".heic":
    case ".heif":
      return "image/heic";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    default:
      return "image/jpeg";
  }
}
