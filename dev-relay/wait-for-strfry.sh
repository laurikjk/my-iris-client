#!/bin/bash
# Wait for strfry to be ready by checking if it can scan the database

MAX_ATTEMPTS=30
SLEEP_TIME=5

echo "Waiting for strfry to be ready..."

for i in $(seq 1 $MAX_ATTEMPTS); do
  echo "Attempt $i/$MAX_ATTEMPTS..."

  # Check container status
  STATUS=$(docker inspect strfry-relay --format='{{.State.Status}}' 2>/dev/null)

  if [ "$STATUS" = "restarting" ]; then
    echo "✗ Container is in restart loop!"
    echo "Container logs:"
    docker logs strfry-relay --tail 100
    exit 1
  fi

  if [ "$STATUS" != "running" ]; then
    echo "Container status: $STATUS, waiting..."
    sleep $SLEEP_TIME
    continue
  fi

  # Container is running, check if it's actually functional
  if docker exec strfry-relay strfry scan '{}' >/dev/null 2>&1; then
    # Double check it's still running after the command
    sleep 1
    if docker inspect strfry-relay --format='{{.State.Status}}' 2>/dev/null | grep -q "running"; then
      echo "✓ Strfry is ready and stable!"
      exit 0
    else
      echo "Container crashed after scan command"
    fi
  fi

  echo "Strfry not ready yet, waiting ${SLEEP_TIME}s..."
  sleep $SLEEP_TIME
done

echo "✗ Timeout waiting for strfry to be ready"
echo "Container logs:"
docker logs strfry-relay --tail 100
exit 1
