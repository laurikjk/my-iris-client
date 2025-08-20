# Docker Development Environment

## Setup

1. (Optional) For environment variables, create .env file and add to docker-compose.yml:

```bash
# .env file (gitignored)
CLAUDE_API_KEY=your_key_here
```

Then add to docker-compose.yml under the service:
```yaml
env_file:
  - .env
```

2. Copy your nvim config:

```bash
cp -r ~/.config/nvim ./nvim-config
```

3. Build and run in background:

```bash
docker-compose up -d --build

# Or use a different host port if 5173 is in use:
PORT=5174 docker-compose up -d --build
```

4. Enter container:

```bash
docker-compose exec iris-dev bash

# Or with zsh if you prefer:
docker-compose exec iris-dev zsh
```

## Available Commands

Inside container:

- `yarn dev` - Run development server
- `yarn test` - Run Playwright tests
- `yarn lint` - Run linter
- `nvim` - Neovim with your config
- `claude --dangerously-skip-permissions` - Claude CLI (use this flag in Docker)

## Syncing Changes Without GitHub

### Using Git Patches

Export changes from container:

```bash
# Inside container - create patch of uncommitted changes
git diff > /tmp/changes.patch

# From host - copy patch out
docker cp $(docker-compose ps -q iris-dev):/tmp/changes.patch ./changes.patch

# Apply patch on host
git apply changes.patch
```

### Quick aliases

Add to your shell config:

```bash
# Extract patch from docker
alias iris-patch-out='docker exec $(docker-compose ps -q iris-dev) git diff > /tmp/changes.patch && docker cp $(docker-compose ps -q iris-dev):/tmp/changes.patch ./changes.patch && echo "Patch saved to ./changes.patch"'

# Apply patch in docker
alias iris-patch-in='docker cp ./changes.patch $(docker-compose ps -q iris-dev):/tmp/changes.patch && docker exec $(docker-compose ps -q iris-dev) git apply /tmp/changes.patch'

# Commit from docker and push to host
alias iris-commit-out='docker exec $(docker-compose ps -q iris-dev) git format-patch HEAD~1 --stdout > last-commit.patch && git am last-commit.patch'
```
