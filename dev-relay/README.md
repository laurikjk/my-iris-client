# Dev Relay

## Info

Dockerized [strfry](https://github.com/hoytech/strfry) server running on ws://localhost:7777

Mounts strfry db and config as a volume

## Run

```bash
docker-compose up -d
```

## Seed with test data

Downloads events from wellorder.xyz dataset: https://wiki.wellorder.net/wiki/nostr-datasets/

```bash
# Seed with custom number of events
./quick-seed.sh 1000

# Default: seeds 500k events
./quick-seed.sh
```

## Important

Clear browser cache/storage to only see events from this relay (ws://localhost:7777)
