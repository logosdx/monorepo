---
"@logos-ui/dom": minor
---

Added `swapClasses(...)` DOM util. Can now pass children to `createElWith(...)`.

Example:

```ts

const faIcon = createElWith('i', {
    class: ['fa', 'fa-chevron-down'],
});

const link = createElWith('a', {
    children: [
        faIcon,
        'Toggle a thing'
    ],
    domEvents: {
        click: () => {

            swapClasses(faIcon, 'fa-chevron-down', 'fa-chevron-up');
        }
    }
});


```
