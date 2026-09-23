import path from "node:path";

export const PHOTOS_ROOT = path.resolve(
  /* turbopackIgnore: true */ process.env.PHOTOS_ROOT ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "fixtures/photos"),
);

export const DATA_DIR = path.resolve(
  /* turbopackIgnore: true */ process.env.DATA_DIR ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "data"),
);

export const CACHE_DIR = path.resolve(
  /* turbopackIgnore: true */ process.env.CACHE_DIR ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "cache"),
);

export const DB_PATH = path.join(DATA_DIR, "album-link.sqlite");

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

export const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-session-secret-change-me-in-prod";

export const APP_URL = process.env.APP_URL || "http://127.0.0.1:43123";

export type DownloadResolution = "orig" | "2000px" | "1000px";

export const RESOLUTION_MAX_EDGE: Record<DownloadResolution, number | null> = {
  orig: null,
  "2000px": 2000,
  "1000px": 1000,
};

export const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
]);
