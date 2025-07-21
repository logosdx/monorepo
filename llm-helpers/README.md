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

- Observer engine class for event-driven architecture @.claude/logosdx/observer.md
- Fetch engine class for a mature FetchAPI wrapper @.claude/logosdx/fetch.md
- Utility functions for flow-control, data structures, and runtime validation @.claude/logosdx/utils.md
- DOM utilities @.claude/logosdx/dom.md
```
