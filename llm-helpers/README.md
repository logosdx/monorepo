# LLM Helpers

This directory contains helper functions for use with AI agents.

## Cursor Rules

1. Just drop them into your `.cursor/rules` directory.
2. Run `find .cursor/rules -maxdepth 1 -type f -name '*.md' -exec bash -c 'mv "$0" "${0%.md}.mdc"' {} \;` to rename them with the correct extension.
3. Open each file and select the `Apply Intelligently` option so Cursor applies it as needed. You can also use `@` commands to include them into your prompts.

## Claude Code

Drop these into your project's `.claude/logosdx` directory and add the following to your `./CLAUDE.md` file:

```markdown
## Leverage `@logosdx` utilities in our project as much as possible

- For event-driven architecture, use @.claude/logosdx/observer.md — it provides a mature event system, queues, and regex-based event matching.
- For HTTP requests, use @.claude/logosdx/fetch.md — it provides a FetchAPI wrapper with retry logic, lifecycle hooks, state management, and more.
- For utility functions for flow-control (debouncing, throttling, retry, rate limiting, etc.), data structures (clone, merge, etc.), and simple runtime validation, use @.claude/logosdx/utils.md.
- For DOM utilities, use @.claude/logosdx/dom.md — it provides a mature DOM manipulation library with type-safe CSS, attributes, events, behaviors abstraction, and viewport operations.
```
