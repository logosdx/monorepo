---
title: Why LogosDX, as a presentation
description: A slide deck on why utils, fetch, hooks, and observer belong in both your frontend and your backend. Built with @logosdx/slides.
layout: page
---

<div class="deck-page vp-doc">


# Why use LogosDX on both ends of the stack


A deck on why `utils`, `fetch`, `hooks`, and `observer` belong in your frontend and your backend. Click the slides, then press <kbd>Space</kbd> or the arrow keys to move. Press <kbd>S</kbd> for speaker notes and <kbd>?</kbd> for every key.

<iframe
    class="deck-frame"
    src="/slides/why-logosdx/index.html"
    title="Why LogosDX, as a presentation"
    allow="fullscreen"
    loading="lazy"
></iframe>

<p class="deck-links">
    <a href="/slides/why-logosdx/index.html" target="_blank" rel="noopener">Open full screen</a>
    ·
    <a href="https://github.com/logosdx/monorepo/tree/master/docs/public/slides/why-logosdx" target="_blank" rel="noopener">View the source</a>
</p>


## How it is built


The deck is one HTML file and one stylesheet. It loads `@logosdx/slides` from the CDN, so it needs no build step. Every slide is a `<slide>` element, speaker notes are `<notes>` elements, and the reveal on each list is a `fragment` attribute. See the [Slides package](/packages/slides) for the markup, keys, and API.

</div>

<style>
.deck-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
}

.deck-frame {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    margin: 1.5rem 0 0.75rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: #14161c;
}

.deck-links {
    margin: 0 0 2rem;
    color: var(--vp-c-text-2);
}
</style>
