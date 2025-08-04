# Development Guidelines

- Don't hardcode Nostr event kinds or other magic numbers. Put them in a constants file`
- Don't import React. Instead import from "react", e.g. `import {RefObject} from "react"`
- Don't repeat yourself — build reusable hooks and components. Keep the code clean and beautiful.
- If file is larger than approximately 200-300 lines, it's probably time to break it into smaller files.
- Check run `yarn lint` after changes
- Avoid layout shift: component state should set on first render when possible, not e.g. empty setState and set on useEffect later. Cache if necessary. Use constant heights where applicable.
- Keep scroll position retention on back nav in feeds functional. Feed should be loaded from cache to reasonable extent. Avoid layout shift.
- Avoid loading spinners for Nostr fetch operations: they're bad UX and Nostr doesnt have a single source of truth anyway. Can't rely solely on "eose" (end of stored events)
- Avoid adding external dependencies, implement especially UI things in our own repo when feasible
- When creating new Playwright tests or debugging failing ones, capture screenshots (`page.screenshot()`) at key points to understand the visual state. Use temp directory (e.g., `/tmp/playwright-debug/`) or remove screenshots after debugging. Use headless mode if possible.
- Dont add "edited/deleted this" comments
- If tests are not passing, adding long timeouts is usually not the solution. Publish & subscribe over nostr is fast.
