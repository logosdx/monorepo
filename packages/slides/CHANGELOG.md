# @logosdx/slides

## 0.2.0

### Minor Changes

- 4bc1fad: Speaker-notes window becomes a control pane

  - Buttons for previous/next column and step, and a blank-screen button, move the deck from the presenter screen.
  - A jump menu goes to any slide, grouped by column and named by each slide's first heading. The slide arrives with its fragments hidden.
  - `→ ← Space Shift+Space PageDown PageUp Home End B . Esc` pressed in the notes window drive the deck. `↑` `↓` still scroll the notes.
  - Images, tables, and code in the notes and the next-slide preview stay inside their panes; a table or code line wider than the pane scrolls.

## 0.1.1

### Patch Changes

- e84c73f: Republish from CI so the CDN paths resolve

  - 0.1.0 was published from a local build, which puts `browser/` at the package root, so `dist/browser/slides.css` and `dist/browser/bundle.js` returned 404 on jsDelivr and unpkg. This release ships the standard `dist/` layout that the docs link to.

## 0.1.0

### Minor Changes

- 92db21f: New package: HTML-native presentation decks

  - `<slides>`, `<slide>`, and `<notes>` markup laid out by `dist/browser/slides.css`: columns snap sideways, panels snap down each column, and a panel taller than the screen scrolls instead of clipping. In print output each panel starts a new page, with every fragment shown.
  - `dist/browser/bundle.js` builds the deck on DOM ready; `<slides manual>` opts out. The npm entry exports `Deck` with no side effects.
  - Keyboard navigation (`→ ← ↓ ↑`, `Space`, `PageUp`/`PageDown`, `Home`/`End`), fullscreen, blank screen, and a help overlay. Keys aimed at form controls and editable elements are ignored.
  - Step-revealed `fragment` elements, URL hash sync with `#/<column>/<panel>/<fragment>` and `#<id>` deep links, and browser history per panel.
  - Speaker notes popup (`S`) with next-panel preview, position, and clocks; pressing `S` again reopens it after a reload.
  - Misplaced slides from unclosed `<p>`/`<li>` tags are repaired with a `console.warn`.
  - `Deck` API: `next()`, `prev()`, `nextColumn()`, `prevColumn()`, `goTo()`, `on()`, `destroy()`, with `deck:ready`, `slide:leave`, `slide:enter`, `fragment:show`, and `fragment:hide` events.

### Patch Changes

- Updated dependencies [92db21f]
  - @logosdx/dom@3.0.4
  - @logosdx/observer@2.5.4
  - @logosdx/utils@7.1.1
