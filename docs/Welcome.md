---
permalink: '/'
---
LogosDX is an collection of utilities brought together for the purpose of simplifying the building of frontend UI's. It is perfect for building websites, small utilities, frontend components, or even full-fledged web-apps. It was designed for the purpose of giving developers a simple-to-use set of tools that they can "just use" in their applications.

- [Visit our github](https://github.com/logosdx/monorepo)
- [See the typedocs](https://typedoc.logosdx.dev/)

## Objectives

**To simplify the NodeJS space by hosting useful utilities in one place**

We aim to provide the basics for developing applications in one place. All of our tooling is dependency-free and solely distributed by the organization. This translates to needing to reach out less for 3rd party packaging.

**Providing a set of tools that perform simple tasks well**

Although we strive for simplicity, it is not without richness. Minimal does not need to mean incomplete or feature-lacking. We believe you can accomplish a simple program interface with a ton of features and functionality underneath. The patterns we aim for are easy to understand and familiar to use. It should feel like "I've done this before."

**Type safety**

In the modern JS world, typescript is a fact of the job, not an opinion. Types are emphasized throughout the entire repo to guarantee a sense of confidence when developing. Not only does it help us to build our tooling, but it helps you to build your apps.

**Runtime safety**

Good programs prevent you from doing dumb things. So should good tooling. Type safety isn't enough sometimes. We make an effort to thoroughly inform the developer of mistakes at runtime by always adding validation steps.

**Shipping separate packages so you implement only what you need**

Because, let's face it, you don't need everything all the time.

## Who this is for

This set of utilities is for developers who are exhausted by modern frameworks, like to write javascript, and just want a set of utilities to build. It's not for the framework-heavy, although you CAN integrate it into any framework. It's not JUST for experimentation or small projects. This can be used extensively throughout production grade software.

> **Usage in NodeJS**
>
> A number of the utilities, since they are built using pure JS, should work perfectly well in a NodeJS context as well. Many of the utilities are based off of `EventTarget`, which has been part of the NodeJS standard since v14.

## List of Utilities

LogosDX provides a powerful collection of standalone utilities that work seamlessly together:

- **[[Packages/Observer|Observer]]** - A supercharged event system that goes beyond EventEmitter
  - Type-safe events with regex pattern matching
  - Promise-based event handling and generators
  - Built-in debugging and validation tools
  - Perfect for building event-driven architectures

- **[[Packages/Fetch|Fetch]]** - A modern wrapper around the Fetch API
  - Type-safe request/response handling
  - Built-in state management and validation
  - Flexible middleware system for request/response transformation
  - Intelligent response type handling

- **[[Packages/State Machine|State Machine]]** - A robust state management solution
  - Full support for modern data types (Maps, Sets)
  - Type-safe state updates and subscriptions
  - Perfect for complex application state

- **[[Packages/Localize|Localize]]** - Type-safe internationalization made simple
  - Dynamic string interpolation
  - Runtime language switching
  - Nested translation support
  - Built for TypeScript

- **[[Packages/Storage|Storage]]** - A powerful storage abstraction
  - Type-safe storage operations
  - Works with any key-value storage system
  - Event-based storage updates
  - Built-in JSON handling

- **[[DOM]]** - DOM manipulation utilities that feel natural
  - jQuery-like selector syntax
  - Simplified event handling
  - Attribute and CSS manipulation helpers
  - Type-safe DOM operations

- **[[Packages/Utils|Utils]]** - Essential JavaScript utilities
  - Common operations and helper functions
  - Used throughout the LogosDX ecosystem
  - Fully typed and tested

- **[[Packages/Kit|App Kit]]** - The complete LogosDX experience
  - Integrates all utilities in a single configuration
  - Perfect for full applications
  - Type-safe from end to end

Each utility is independently installable and zero-dependency, letting you use exactly what you need. They're designed to work perfectly together while being completely optional.
