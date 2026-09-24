# Album Link

Self-hosted gallery over your existing NAS photo folders. Guests open a secret link and browse albums in the browser. Files stay on disk — the app only scans and serves them.

## What it does

- Indexes any folder that contains images (nested folders included)
- Issues revocable **group**, **person**, and **per-album** share links
- Caps download size per link (`orig`, `2000px`, or `1000px`)
- Optional **NSFW** blur + confirm before opening an album
- Optional **watermark** on album links (uses `public/watermark.png`; group and person links stay clean)
- Admin UI for groups, people, and folders (access, NSFW, watermark, album links)

## Folder layout

Point `PHOTOS_ROOT` at a tree like:

```text
Photos/
├── 2024/
│   ├── 2024-01-01_event_1/
│   └── 2024-05-05_event_2/
├── 2025/
│   ├── 2025-04-28_event_3/
│   └── 2025-06-06_event_4/
└── Other/          ← a folder with images is an album even at the top level
```

The first path segment is only a group label (shown as the top folder in the gallery). Any directory that contains images is indexed. Nothing is imported or copied.

On a share link, guests first see those top-level folders, then the albums inside the one they open.

## Quick start (local)

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). Admin: [/admin](http://127.0.0.1:43123/admin) with password `changeme` (from `.env`).

1. Click **Scan now**
2. Create a **group** or **person**, assign albums, copy the share link  
   — or open **Folders**, copy an album link (always capped at 1000px)

## Admin

| Page | Purpose |
| --- | --- |
| **Groups** | One link for a chat; assign albums; max download size |
| **People** | Personal link; group membership plus direct album access; own download cap |
| **Folders** | Per-album link, NSFW, watermark, and who (groups/people) can open each album |

People inherit albums from their groups (shown checked and locked). Extra albums can be assigned directly on the person or from the Folders page.

## Sharing model

- **Group link** — albums assigned to the group; download cap you choose; no watermark
- **Person link** — union of group albums + direct albums; own download cap; no watermark
- **Album link** — that folder only; downloads capped at **1000px**; optional watermark from `public/watermark.png`; **expires after 1 month** (Roll issues a new token and resets the expiry)
- **Roll** replaces the token and kills the old URL without changing assignments

Download caps (longest edge, never upscaled):

- `1000px` ≤ 1000px  
- `2000px` ≤ 2000px  
- `orig` original file  

## Docker on a NAS

Compose mounts the host photo tree at `/app/photos` (read-only). Set `PHOTOS_HOST_PATH` if the albums are not at the default path.

```bash
# optional: override where albums live on the host
export PHOTOS_HOST_PATH=/volume1/photos/albums

export ADMIN_PASSWORD='a-strong-password'
export SESSION_SECRET='a-long-random-string'
export APP_URL=https://photos.example.com
docker compose up -d --build
```

`PHOTOS_ROOT` in `.env` is only for `npm run dev`. Inside the container it is always `/app/photos`.

Volumes:

| Mount | Purpose |
| --- | --- |
| `${PHOTOS_HOST_PATH}` → `/app/photos:ro` | Originals, read-only |
| `./data` | SQLite index, groups, people, tokens, album flags |
| `./cache` | Thumbnails and resized downloads |

Rebuild when app code changes (`docker compose up -d --build`). Photos, DB, cache, and runtime env do not require a rebuild.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PHOTOS_ROOT` | `./photos` | Photo tree (local npm only) |
| `PHOTOS_HOST_PATH` | `/volume1/photos/albums` | Host path mounted in Docker |
| `DATA_DIR` | `./data` | SQLite |
| `CACHE_DIR` | `./cache` | Image cache |
| `ADMIN_PASSWORD` | `changeme` | Admin login |
| `SESSION_SECRET` | (dev default) | Cookie signing |
| `APP_URL` | `http://127.0.0.1:43123` | Base URL when minting share links |
| `APP_NAME` | `album link` | Name shown in the app |
| `PORT` | `43123` (dev script) | Listen port |

## Scripts

- `npm run dev` — development on port 43123  
- `npm run build` / `npm start` — production  
- `npm run lint` — ESLint  

## Security notes

- Put this behind HTTPS (Caddy/Traefik/nginx/Cloudflare) when exposing outside your LAN.
- Share links are unguessable tokens; roll them if leaked.
- Guests never get a NAS or UGOS account.
- Watermark only applies to album links; replace `public/watermark.png` with your own file.
