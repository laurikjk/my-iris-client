# Development Guidelines

- Don't hardcode Nostr event kinds or other magic numbers. Put them in /src/utils/constants.ts
- Don't import React. Instead import from "react", e.g. `import {RefObject} from "react"`
- Don't repeat yourself — build reusable hooks and components
- Check `yarn build` and `yarn lint` before committing