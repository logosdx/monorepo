---
permalink: '/'
---
LogosUI is an collection of utilities brought together for the purpose of simplifying the building of frontend UI's. It is perfect for building websites, small utilities, frontend components, or even full-fledged web-apps. It was designed for the purpose of giving developers a simple-to-use set of tools that they can "just use" in their applications. 

## Objectives

**To simplify the frontend space by hosting useful utilities in one place**

We aim to provide the basics for developing a web application in one place. All of our tooling is dependency-free and solely distributed by the organization. The translates to needing to reach out less for 3rd party packaging.

**Providing a set of tools that perform simple tasks well**

Although we strive for simplicity, it is not without richness. Minimal does not need to mean incomplete or feature-lacking. We believe you can accomplish a simple program interface with a ton of features and functionality underneath. The patterns we aim for are easy to understand and familiar to use. It should feel like "I've done this before." 

**Type safety**

In the modern JS world, typescript is a fact. Types are emphasized throughout the entire repo to guarantee a sense of confidence when developing. Not only does it help us to build our tooling, but it helps you to build your apps.

**Runtime safety**

Good programs prevent you from doing dumb things. So should good tooling. Type safety isn't enough sometimes. We make an effort to thoroughly inform the developer of mistakes at runtime.

**Shipping separate packages so you implement only what you need**

Because, let's face it, you don't need everything all the time.

## Who this is for

This set of utilities is for developers who are exhausted by modern frontend choice and wish to use something that is simpler to work with. 

If you're a DIY type of person, these utils should be a good set of utilities to help you build components.

> **Usage in NodeJS** 
> 
> A number of the utilities, since they are built using pure JS, should work perfectly well in a NodeJS context as well. Many of the utilities are based off of `EventTarget`, which has been part of the NodeJS standard since v14.

## List of Utilities 

- [[DOM]]
	- Tools to help you manipulate the DOM
- [[Packages/Fetch|Fetch]]
	- A simple wrapper around Fetch API for more ergonomic usage
- [[Packages/Localize|Localize]]
	- A simple translation tool with an emphasis on types
- [[Packages/Observer|Observer]]
	- A feature-rich observer with debugging capabilities, regex event emissions and listeners, and more
- [[Packages/State Machine|State Machine]]
	- A state manager with support for using newer data types in the state (Maps and Sets)
- [[Packages/Storage|Storage]]
	- A storage API that saves and retrieves JSON into key-value storage systems, such as LocalStorage or AsyncStorage
- [[Packages/Utils|Utils]]
	- A collection of JS utilities used within the libraries
- [[Packages/Kit|App Kit]]
	- A full kit that instantiates all the above utilities in a single configuration block
	- Has all the above libraries available
