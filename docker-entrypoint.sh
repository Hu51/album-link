#!/bin/sh
set -e

mkdir -p /app/data /app/cache
# Bind-mounted files keep the host owner (often not the container user).
chown -R album:album /app/data /app/cache

exec /usr/sbin/runuser -u album -- "$@"
