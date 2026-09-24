import fs from "node:fs";
import path from "node:path";
import { PHOTOS_ROOT } from "./config";

export function resolvePhotoPath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(PHOTOS_ROOT, normalized);
  const root = path.resolve(PHOTOS_ROOT) + path.sep;
  if (absolute !== path.resolve(PHOTOS_ROOT) && !absolute.startsWith(root)) {
    throw new Error("Path escapes photos root");
  }
  return absolute;
}

export function assertReadableFile(absolutePath: string): void {
  if (
    !fs.existsSync(/* turbopackIgnore: true */ absolutePath) ||
    !fs.statSync(/* turbopackIgnore: true */ absolutePath).isFile()
  ) {
    throw new Error("File not found");
  }
}

export function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}
