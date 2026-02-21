---
# https://vitepress.dev/reference/default-theme-home-page
layout: home
title: Logos DX - Focused TypeScript utilities for building JS apps on any runtime
description: Focused TypeScript utilities for building JS apps on any runtime

hero:
  name: "Logos DX"
  text: "Focused TypeScript utilities for building JS apps on any runtime"
  tagline: A rational developer experience
  image:
    src: ./images/insignia.png
    alt: Logos DX
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Cheat Sheet
      link: /cheat-sheet
    - theme: alt
      text: Sponsor Us
      link: https://github.com/sponsors/logosdx

features:
  - title: Utils
    details: Error tuples, retry, circuit breakers, rate limiting, runtime validation, and safe data operations. The foundation layer.
    icon: { src: /images/svg/cogs.svg, alt: Utils }
    link: /packages/utils
  - title: Fetch
    details: Native fetch with retries, timeouts, lifecycle hooks, streaming, and chainable response parsing. No dependencies.
    icon: { src: /images/svg/cloud.svg, alt: Fetch }
    link: /packages/fetch/
  - title: Observer
    details: Typed event system with regex subscriptions, async iteration, priority queues, and component observation. Built for debugging.
    icon: { src: /images/svg/eyes.svg, alt: Observer }
    link: /packages/observer
  - title: Storage
    details: Type-safe persistence with pluggable drivers, scoped prefixes, and event hooks. Works with any storage interface.
    icon: { src: /images/svg/box.svg, alt: Storage }
    link: /packages/storage
  - title: DOM
    details: Framework-free DOM manipulation with type-safe CSS, attributes, behaviors, and viewport utilities. Selector caching built in.
    icon: { src: /images/svg/code.svg, alt: DOM }
    link: /packages/dom/
  - title: Localize
    details: Lightweight i18n with ICU message syntax, plural rules, scoped translations, and a CLI extractor. No framework required.
    icon: { src: /images/svg/globe.svg, alt: Localize }
    link: /packages/localize/
  - title: State Machine
    details: Finite state machines with guards, async invoke, persistence, and wildcard listeners. Type-safe transitions throughout.
    icon: { src: /images/svg/diagram.svg, alt: State Machine }
    link: /packages/state-machine/
  - title: React
    details: Context providers and hooks for Observer, Fetch, Storage, Localize, and State Machine. Full type inference with subpath imports.
    icon: { src: /images/svg/atom.svg, alt: React }
    link: /packages/react
---
