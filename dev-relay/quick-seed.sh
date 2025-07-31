#!/bin/bash
# seed.sh - Seed strfry with wellorder dataset
# Requires: bzip2, docker

command -v bzip2 >/dev/null || { echo "Error: bzip2 not found"; exit 1; }
docker ps --format '{{.Names}}' | grep -q "^strfry-relay$" || { echo "Error: strfry-relay not running"; exit 1; }

URL="https://wellorder.xyz/nostr/nostr-wellorder-early-500k-v1.jsonl.bz2"
BEFORE=$(docker exec strfry-relay strfry scan '{}' 2>/dev/null | wc -l)

if [ -n "$1" ]; then
    curl -sL "$URL" | bzip2 -d | head -n "$1" | docker exec -i strfry-relay strfry import
else
    curl -sL "$URL" | bzip2 -d | docker exec -i strfry-relay strfry import
fi

AFTER=$(docker exec strfry-relay strfry scan '{}' | wc -l)
echo "Imported: $((AFTER - BEFORE)) events (Total: $AFTER)"
