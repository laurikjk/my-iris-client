#!/bin/bash
# Wait for strfry to be ready by checking if it can scan the database

MAX_ATTEMPTS=30
SLEEP_TIME=5

echo "Waiting for strfry to be ready..."

for i in $(seq 1 $MAX_ATTEMPTS); do
  echo "Attempt $i/$MAX_ATTEMPTS..."

  # Check if container is running
  if ! docker ps --format '{{.Names}}' | grep -q "^strfry-relay$"; then
    echo "Container not running yet"
    sleep $SLEEP_TIME
    continue
  fi

  # Check if strfry can scan the database
  if docker exec strfry-relay strfry scan '{}' 2>&1 | head -1 >/dev/null 2>&1; then
    echo "✓ Strfry is ready!"
    exit 0
  fi

  echo "Strfry not ready yet, waiting ${SLEEP_TIME}s..."
  sleep $SLEEP_TIME
done

echo "✗ Timeout waiting for strfry to be ready"
echo "Container logs:"
docker logs strfry-relay --tail 50
exit 1
