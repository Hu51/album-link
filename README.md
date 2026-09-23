# Album Link

Self-hosted gallery over your existing NAS photo folders. Guests get revocable group or personal links. Files stay on disk — the app only scans and serves them.

## Folder layout

Point `PHOTOS_ROOT` at a tree like:

```text
Photos/
├── 2024/
│   ├── 2024-01-01_event_1/
│   └── 2024-05-05_event_2/
└── 2025/
    └── 2025-02-02_event_3/
```

Year folders contain event folders. Event folders contain images. Nothing is imported or copied.

## Quick start (local)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). Admin: [/admin](http://127.0.0.1:43123/admin) with password `changeme` (from `.env.local`).

Sample photos live in `fixtures/photos/`. Click **Scan now**, create a group, assign events, copy the share link.

## Docker on a NAS

```bash
export PHOTOS_HOST_PATH=/path/to/your/Photos
export ADMIN_PASSWORD='a-strong-password'
export SESSION_SECRET='a-long-random-string'
export APP_URL=https://photos.example.com
docker compose up -d --build
```

Volumes:

| Mount | Purpose |
| --- | --- |
| `$PHOTOS_HOST_PATH` → `/photos:ro` | Originals, read-only |
| `./data` | SQLite index, groups, people, tokens |
| `./cache` | Thumbnails and resized downloads |

## Sharing model

- **Groups** (~Family, Friends): one secret URL for the chat; assign event folders with checkboxes; set max download to `full`, `2k`, or `hd`.
- **People**: member of one or more groups; personal URL shows the union of those events; own download cap.
- **Roll token** kills the old link without changing assignments.

Download caps (longest edge, never upscaled):

- `hd` ≤ 1920px  
- `2k` ≤ 2560px  
- `full` original file  

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PHOTOS_ROOT` | `./fixtures/photos` | Photo tree |
| `DATA_DIR` | `./data` | SQLite |
| `CACHE_DIR` | `./cache` | Image cache |
| `ADMIN_PASSWORD` | `changeme` | Admin login |
| `SESSION_SECRET` | (dev default) | Cookie signing |
| `APP_URL` | `http://127.0.0.1:43123` | Used when minting share URLs |
| `PORT` | `43123` (dev script) | Listen port |

## Scripts

- `npm run dev` — development on port 43123  
- `npm run build` / `npm start` — production  
- `npm run lint` — ESLint  

## Security notes

- Put this behind HTTPS (Caddy/Traefik/nginx) when exposing outside your LAN.
- Share links are unguessable tokens; roll them if leaked.
- Guests never get a NAS or UGOS account.
