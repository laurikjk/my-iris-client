# Docker Development Environment

## Setup

1. Copy your nvim config:

```bash
cp -r ~/.config/nvim ./nvim-config
```

2. Build and run in background:

```bash
docker-compose -f docker-compose.dev.yml up -d --build

# Or use a different host port if 5173 is in use:
PORT=5174 docker-compose -f docker-compose.dev.yml up -d --build
```

3. Enter container:

```bash
docker-compose -f docker-compose.dev.yml exec iris-dev bash

# Or with zsh if you prefer:
docker-compose -f docker-compose.dev.yml exec iris-dev zsh
```

## Available Commands

Inside container:

- `yarn dev` - Run development server
- `yarn test` - Run Playwright tests
- `yarn lint` - Run linter
- `nvim` - Neovim with your config
- `claude` - Claude CLI (set CLAUDE_API_KEY in docker-compose.dev.yml)

## Claude CLI Setup

Add your API key to docker-compose.dev.yml or create .env file:

```
CLAUDE_API_KEY=your_key_here
```
