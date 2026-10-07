---
description: Usage patterns for the @logosdx/slides package.
globs: '*.html, *.ts'
---

# @logosdx/slides - LLM Helper

> **Error handling rule:** Use `attemptSync()` from `@logosdx/utils` around `deck.goTo()` when the target comes from user input. Never use try-catch.

HTML-native presentation decks: `<slides>`, `<slide>`, and `<notes>` markup laid out by CSS scroll-snap, with a `Deck` class for keys, fragments, URL hash sync, and a speaker notes popup.


## Core Concept

A deck is a row of columns; a column holds vertical panels or is itself a panel. Panels are at least one viewport tall and scroll when taller, so content is never scaled or clipped. The stylesheet alone lays out and scrolls the deck; the script adds navigation and state.

```
slides                      one per document
├── slide horizontal        column with no vertical children = a panel
└── slide horizontal        column
    ├── slide vertical      panel
    │   └── notes           speaker notes, never rendered
    └── slide vertical      panel
```

Reading order runs down each column, then on to the next column. Positions are 0-based `{ column, panel }`.


## Loading

```html
<!-- CDN: the bundle builds the deck on DOM ready for a <slides> without `manual` -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@logosdx/slides@latest/dist/browser/slides.css">
<script src="https://cdn.jsdelivr.net/npm/@logosdx/slides@latest/dist/browser/bundle.js"></script>
```

```typescript
// npm: importing has no side effects; construct the deck yourself
import { Deck } from '@logosdx/slides';

const deck = new Deck();
```

The stylesheet is not a package export. npm users link or copy `node_modules/@logosdx/slides/dist/browser/slides.css`.

The browser global is `LogosDx.Slides.Deck`. The auto-created deck has no accessor: to subscribe to events from a CDN page, write `<slides manual>` and call `new LogosDx.Slides.Deck()`.


## Markup Reference

| Element / attribute | On | Set by | Meaning |
|---|---|---|---|
| `<slides>` | | author | The deck; one per document |
| `<slide horizontal>` | child of `<slides>` | author or inferred | Column |
| `<slide vertical>` | child of a column | author or inferred | Panel |
| `<notes>` | inside any slide, or loose in a column | author | Speaker notes; loose ones belong to the panel before them, or to the first panel when none precedes |
| `fragment` | any element in a slide | author | Revealed one `Space` at a time |
| `revealed` | `[fragment]` | deck | Fragment shown; style reveals with it |
| `active` | panel | deck | Panel being presented |
| `data-ready` | `slides` | deck | Deck running; fragments hide only under it |
| `data-implicit` | `slide` | deck | Panel wrapped around loose content, other than `<notes>`, before a column's first panel |
| `manual` | `slides` | author | Browser bundle skips auto-init |

Theming custom properties on `slides`: `--slide-bg`, `--slide-fg`, `--deck-font`, `--slide-padding`. Overlays carry `data-slides-overlay="help"` / `"blank"`.


## Deck API

```typescript
const deck = new Deck(root?);       // root defaults to the first <slides>

deck.next();                        // Space: next fragment, else next panel, crossing columns
deck.prev();                        // Shift+Space
deck.nextColumn();                  // →
deck.prevColumn();                  // ←
deck.goTo('pricing-table');         // panel containing the element with that id, all fragments shown
deck.goTo({ column: 2, panel: 0, fragment: 1 });   // fragment = revealed count; omit for all

const stop = deck.on('slide:enter', ({ slide, column, panel }) => { /* ... */ });
stop();

deck.destroy();                     // unbind, remove overlays/active/data-ready, close notes popup
```

| Throws | When |
|---|---|
| `new Deck()` | another `Deck` is live, no `<slides>` exists, or `root` is not `<slides>` |
| `goTo(id)` | no element in the deck has that id (`Error`) |
| `goTo(position)` | column, panel, or fragment count out of range (`RangeError`) |

```typescript
import { attemptSync } from '@logosdx/utils';

const [, err] = attemptSync(() => deck.goTo(input.value));
if (err) showError(`No slide contains #${input.value}`);
```


## Events

| Event | Payload | Fires |
|---|---|---|
| `deck:ready` | `{ slide }` | Once, async, with the first active panel; subscribe right after construction |
| `slide:leave` | `{ slide, column, panel }` | Before each `slide:enter` |
| `slide:enter` | `{ slide, column, panel }` | After each active-panel change |
| `fragment:show` | `{ slide, fragment, index }` | Per fragment revealed by a step (`Space`, `next()`, `goTo` with `fragment` on the active panel); a step on a pending move's target fires at once, before its `slide:enter` |
| `fragment:hide` | `{ slide, fragment, index }` | Per fragment re-hidden by a step |

Entering a panel resets its fragments silently: forwards hides all, backwards shows all. Types live on the `Deck` namespace: `Deck.EventMap`, `Deck.Event`, `Deck.Listener<E>`, `Deck.Position`, `Deck.Target`, `Deck.SlideChange`, `Deck.FragmentChange`.


## Keyboard

| Key | Action |
|---|---|
| `→` / `←` | Next / previous column, first panel |
| `↓` / `↑` | Scroll a tall panel, then next / previous panel in the column |
| `Space` / `Shift+Space` | `next()` / `prev()` |
| `PageDown` / `PageUp` | Next / previous panel across columns, skipping fragments |
| `Home` / `End` | First / last panel |
| `S` | Open or reopen the notes popup (`lx-notes`) |
| `F` | Toggle fullscreen |
| `.` / `B` | Toggle blank screen |
| `?` / `Esc` | Toggle help / close help or unblank |

Keys are ignored with Ctrl, Meta, or Alt held, and when aimed at `input`, `textarea`, `select`, `button`, `summary`, `audio[controls]`, `video[controls]`, or `contenteditable`.


## URL Hash

| Hash | Lands on |
|---|---|
| `#/<column>/<panel>` | Position, all fragments shown |
| `#/<column>/<panel>/<fragment>` | Position with that many fragments shown |
| `#<id>` | Panel containing the element |

The deck writes the positional form. A panel change pushes a history entry; a fragment step replaces it. A bad positional hash warns and does nothing; an unmatched id or bare `#` does nothing.


## Pitfalls

- **Close `<p>` and `<li>` inside slides.** The parser does not close a paragraph at `</slide>`, so the next slide nests inside it. The deck repairs misplaced slides and logs one `console.warn` per triggering slide, but block tags after an open `<p>` still close it early and land content in the wrong panel.
- **One deck per document.** A second `<slides>` logs `console.error` and is ignored. A second `new Deck()` throws until `destroy()`.
- **Auto-init is CDN-only.** The npm import never creates a deck.
- **Notes popup is written, not scripted.** A reload blanks it; pressing `S` reopens it. A blocked popup logs `console.warn`.
- **No transitions, zoom, presenter timer, or Markdown input.** Those are out of scope; build on `deck.on()` events.
