#!/bin/bash
# seed.sh - Seed strfry with wellorder dataset
# Requires: bzip2, docker

command -v bzip2 >/dev/null || { echo "Error: bzip2 not found"; exit 1; }
docker ps --format '{{.Names}}' | grep -q "^strfry-relay$" || { echo "Error: strfry-relay not running"; exit 1; }

URL="https://wellorder.xyz/nostr/nostr-wellorder-early-500k-v1.jsonl.bz2"
FILENAME="nostr-wellorder-early-500k-v1.jsonl.bz2"
BEFORE=$(docker exec strfry-relay strfry scan '{}' 2>/dev/null | wc -l)

# Download dataset if not cached locally
if [ ! -f "$FILENAME" ]; then
    echo "Downloading dataset (this may take a while on first run)..."
    curl -L --progress-bar "$URL" -o "$FILENAME"
    echo "Dataset cached locally as $FILENAME"
else
    echo "Using cached dataset: $FILENAME"
fi

# Import events
if [ -n "$1" ]; then
    echo "Importing first $1 events..."
    bzip2 -dc "$FILENAME" | head -n "$1" | docker exec -i strfry-relay strfry import
else
    echo "Importing all events..."
    bzip2 -dc "$FILENAME" | docker exec -i strfry-relay strfry import
fi

AFTER=$(docker exec strfry-relay strfry scan '{}' | wc -l)
echo "Imported: $((AFTER - BEFORE)) events (Total: $AFTER)"
