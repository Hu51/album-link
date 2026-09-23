#!/bin/sh
set -e

mkdir -p /app/data /app/cache
# Bind-mounted files keep the host owner (often not the container user).
chown -R album:album /app/data /app/cache

# docker exec is root and can list nested album folders that the
# container user cannot. The photos mount stays read-only.
echo "starting as root so nested photo folders can be read" >&2
exec "$@"
