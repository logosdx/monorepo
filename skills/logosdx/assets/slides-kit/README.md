# Slides starter kit


A working `@logosdx/slides` deck. Open `index.html` in a browser; no build step.

## Files


| File | Edit it to |
|------|-----------|
| `index.html` | Replace the slides. Every layout in the kit (title, fragments, a section with stacked panels, two columns, code, image, quote, closing) is one block to copy or delete. |
| `theme.css` | Change colors, fonts, spacing, and the building blocks (`.lede`, `.cols`, `.card`, `.quote`). The variables at the top (`--slide-bg`, `--slide-fg`, `--accent`, `--deck-font`, `--slide-padding`) restyle the whole deck. |

## Use it


    cp -r <this folder> my-talk
    open my-talk/index.html

`slides.css` and the script load from the jsDelivr CDN; `theme.css` loads from this folder. The deck works from `file://` with an internet connection.

## Keys


| Key | Action |
|-----|--------|
| `Space` / `Shift+Space` | Next / previous step |
| `→` / `←` | Next / previous column |
| `S` | Speaker notes window with next-slide preview, buttons, and a jump menu |
| `?` | All keys |

## Pin a version


Replace `@latest` in the two CDN URLs in `index.html` with a published version from npm so a later release cannot change a deck you already presented.
