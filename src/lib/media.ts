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

export async function getThumbnail(relativePath: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const absolute = resolvePhotoPath(relativePath);
  assertReadableFile(absolute);
  const mtime = Math.floor(
    fs.statSync(/* turbopackIgnore: true */ absolute).mtimeMs,
  );
  const key = cacheKey(["thumb", relativePath, String(mtime)]);
  const { buffer } = await ensureCacheFile(key, "jpg", async () =>
    sharp(absolute)
      .rotate()
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer(),
  );
  return { buffer, contentType: "image/jpeg" };
}

export async function getMediaFile(
  relativePath: string,
  resolution: DownloadResolution,
  disposition: "inline" | "attachment",
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

  if (maxEdge === null) {
    return {
      buffer: fs.readFileSync(/* turbopackIgnore: true */ absolute),
      contentType: contentTypeFor(filename),
      filename,
      disposition,
    };
  }

  const key = cacheKey(["dl", relativePath, String(mtime), resolution]);
  const { buffer } = await ensureCacheFile(key, "jpg", async () => {
    const image = sharp(absolute).rotate();
    const meta = await image.metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);
    if (longest > 0 && longest <= maxEdge) {
      return fs.readFileSync(/* turbopackIgnore: true */ absolute);
    }
    return image
      .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  });

  const outName =
    resolution === "orig"
      ? filename
      : `${path.parse(filename).name}-${resolution}.jpg`;

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
