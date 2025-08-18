<p align="center">
    <a href="https://logosdx.dev">
        <img src="./docs/public/images/logo.png" alt="LogosDX"/>
    </a>
</p>

<h1 align="center">Logos DX</h1>

<p align="center">
    Focused TypeScript utilities for building cross-runtime applications, ETL pipelines, UIs, and more. Use it in browsers, React Native, Node.js, or anywhere JavaScript runs.
    <br/>
    <br/>
    <a href="https://logosdx.dev/">Documentation</a> |
    <a href="https://logosdx.dev/getting-started.html">Getting Started</a> |
    <a href="https://logosdx.dev/cheat-sheet.html">Cheat Sheet</a>
</p>

---

**Logos** */lōgōs/ n.*<br/>
&nbsp;&nbsp;&nbsp;&nbsp;**¹** From the ancient Greek meaning "divine reason" and "rational principle."<br/>
&nbsp;&nbsp;&nbsp;&nbsp;**²** Represents the fundamental order that governs the universe.<br/>
&nbsp;&nbsp;&nbsp;&nbsp;**³** The stoics believed it was the rational law underlying all things.<br/>

**DX** */di-eks/ n.*<br/>
&nbsp;&nbsp;&nbsp;&nbsp;**¹** Stands for "developer experience."<br/>

**LogosDX** */lōgōs di-eks/ n.*<br/>
&nbsp;&nbsp;&nbsp;&nbsp;**¹** A rational developer experience.<br/>

---

## Ready-to-use Packages

- `@logosdx/utils`: Production utilities that compose. Resilience built in.
- `@logosdx/observer`: Events that understand patterns. Queues that manage themselves.
- `@logosdx/fetch`: HTTP that handles failure. Automatically.
- `@logosdx/storage`: One API for your many key-value stores.
- `@logosdx/localize`: Localization utilities for everything from languages to customer-specific strings.
- `@logosdx/dom`: For those who like to raw-dawg the DOM.

## Under-construction

- `@logosdx/state-machine`: State management as streams, not stores.
- `@logosdx/kit`: Bootstrap your app. Type-safe from day one. All the packages in one place.

## Roadmap

- `@logosdx/react`: All of the above, but for React. Use it in Next.js, React Native, or anywhere else.

## LLM Helpers

> [!TIP]
> Don't let AI do your work for you. It's not a replacement for human intelligence. It's a tool to help you.

We have LLM helpers available for you to use in Cursor, VSCode, and Claude Code.

For more information, see the [LLM Helpers](./llm-helpers/README.md) directory.

**Add them to your `.cursor/rules` or `.claude` directory.**

```bash
# For Claude
curl -L "https://codeload.github.com/logosdx/monorepo/tar.gz/refs/heads/master" \
| tar -xz -C .claude --strip-components=2 "monorepo-master/llm-helpers/*.md"

# For Cursor
curl -L "https://codeload.github.com/logosdx/monorepo/tar.gz/refs/heads/master" \
| tar -xz -C .cursor/rules --strip-components=2 "monorepo-master/llm-helpers/*.md"
```

## Philosophy

- TypeScript-first
- Resilience built in
- Tree-shakable
- Runtime agnostic
- Small and fast
- Debuggable, testable, and well-documented
- Zero external dependencies

## License

MIT © [LogosDX](https://logosdx.dev)