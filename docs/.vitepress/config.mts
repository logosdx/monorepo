import { DefaultTheme, defineConfig } from 'vitepress'

const packages: DefaultTheme.SidebarItem[] = [
  ['Observer', 'observer'],
  ['Utils', 'utils'],
  ['Fetch', 'fetch'],
  ['Dom', 'dom'],
  ['Storage', 'storage'],
  ['Localize', 'localize'],
  // ['State Machine', 'state-machine'],
].map(([text, link]) => ({
  text,
  link: `/packages/${link}`,
}));

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Logos DX",
  description: "Focused TypeScript utilities for building JS apps in any runtime",

  // https://vitepress.dev/reference/default-theme-config
  themeConfig: {
    logo: '/images/app-icon-red.png',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/logosdx/monorepo' },
    ],

    nav: [
      { text: 'Home', link: '/' },
      { text: 'TypeDocs', link: 'https://typedoc.logosdx.dev' }
    ],


    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'What is LogosDX?', link: '/what-is-logosdx' }
        ]
      },
      {
        text: 'Packages',
        items: packages
      }
    ],

    editLink: {
      pattern: 'https://github.com/logosdx/monorepo/edit/master/docs/:path',
      text: 'Edit this page on GitHub'
    },
    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: `Copyright © 2023+ Logos DX`
    }
  },
  head: [
    ['link', { rel: 'icon', href: '/images/app-icon-red.png' }],
    ['link', { rel: 'icon', href: '/images/app-icon-white.png', media: '(prefers-color-scheme: dark)' }],
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.0.0/css/fontawesome.min.css' }],
    ['script', { src: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.0.0/js/all.min.js' }],
  ],

});
