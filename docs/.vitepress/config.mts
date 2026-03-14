import { DefaultTheme, defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import markdownItPlantuml from 'markdown-it-plantuml'

const simplePackages: DefaultTheme.SidebarItem[] = [
  ['Hooks', 'hooks'],
  ['React', 'react'],
  // ['State Machine', 'state-machine'],
].map(([text, link]) => ({
  text,
  link: `/packages/${link}`,
}));

const packages: DefaultTheme.SidebarItem[] = [
  {
    text: 'Observer',
    link: '/packages/observer/',
    collapsed: true,
    items: [
      { text: 'Events', link: '/packages/observer/events' },
      { text: 'Generators', link: '/packages/observer/generators' },
      { text: 'Queues', link: '/packages/observer/queues' },
      { text: 'Relay', link: '/packages/observer/relay' },
      { text: 'Advanced', link: '/packages/observer/advanced' },
    ]
  },
  {
    text: 'Utils',
    link: '/packages/utils/',
    collapsed: true,
    items: [
      { text: 'Error Handling', link: '/packages/utils/error-handling' },
      { text: 'Flow Control', link: '/packages/utils/flow-control' },
      { text: 'Data Operations', link: '/packages/utils/data' },
      { text: 'Performance & Caching', link: '/packages/utils/performance' },
      { text: 'Validation & Type Guards', link: '/packages/utils/validation' },
    ]
  },
  {
    text: 'Fetch',
    link: '/packages/fetch/',
    collapsed: true,
    items: [
      { text: 'Configuration', link: '/packages/fetch/configuration' },
      { text: 'Making Requests', link: '/packages/fetch/requests' },
      { text: 'Hooks', link: '/packages/fetch/hooks' },
      { text: 'Plugins', link: '/packages/fetch/plugins' },
      { text: 'Resilience', link: '/packages/fetch/resilience' },
      { text: 'Policies', link: '/packages/fetch/policies' },
      { text: 'Events', link: '/packages/fetch/events' },
      { text: 'Advanced', link: '/packages/fetch/advanced' },
    ]
  },
  {
    text: 'State Machine',
    link: '/packages/state-machine/',
    collapsed: true,
    items: [
      { text: 'API Reference', link: '/packages/state-machine/api' },
      { text: 'Practical Guide', link: '/packages/state-machine/guide' },
    ]
  },
  {
    text: 'Dom',
    link: '/packages/dom/',
    collapsed: true,
    items: [
      { text: 'Selection', link: '/packages/dom/selection' },
      { text: 'Styling', link: '/packages/dom/styling' },
      { text: 'Aria', link: '/packages/dom/aria' },
      { text: 'Events', link: '/packages/dom/events' },
      { text: 'Templates', link: '/packages/dom/templates' },
      { text: 'Animate', link: '/packages/dom/animate' },
      { text: 'Observers', link: '/packages/dom/observers' },
    ]
  },
  {
    text: 'Storage',
    link: '/packages/storage/',
    collapsed: true,
    items: [
      { text: 'API Reference', link: '/packages/storage/api' },
      { text: 'Drivers', link: '/packages/storage/drivers' },
      { text: 'Events', link: '/packages/storage/events' },
    ]
  },
  {
    text: 'Localize',
    link: '/packages/localize/',
    collapsed: true,
    items: [
      { text: 'Translations', link: '/packages/localize/translations' },
      { text: 'Pluralization', link: '/packages/localize/pluralization' },
      { text: 'Intl Formatting', link: '/packages/localize/intl' },
      { text: 'Async Loading', link: '/packages/localize/async-loading' },
      { text: 'Namespaces', link: '/packages/localize/namespaces' },
      { text: 'Events', link: '/packages/localize/events' },
      { text: 'Type Extractor', link: '/packages/localize/type-extractor' },
      { text: 'API Reference', link: '/packages/localize/api' },
    ]
  },
  simplePackages[0], // Hooks
  simplePackages[1], // React
];

const metadata = {
  title: 'Logos DX',
  description: 'Focused TypeScript utilities for building JS apps in any runtime',
  image: 'https://logosdx.dev/images/screenshot-site.png',
}

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
  title: 'Logos DX',
  description: 'Focused TypeScript utilities for building JS apps in any runtime',

  markdown: {
    config: (md) => {
      md.use(markdownItPlantuml)
    },
  },

  vite: {
    optimizeDeps: {
      include: ['mermaid'],
    },
  },

  // https://vitepress.dev/reference/default-theme-config
  themeConfig: {
    logo: '/images/app-icon-red.png',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/logosdx/monorepo' },
    ],

    nav: [
      { text: 'Home', link: '/' },
      { text: 'TypeDocs', link: 'https://typedoc.logosdx.dev' },
      { text: 'llms.txt', link: '/llms.txt' }
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
      message: '<a href="https://github.com/logosdx/monorepo/blob/master/LICENSE">BSD-3-Clause License</a> · <a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a>',
      copyright: `Copyright © 2023+ Logos DX`
    }
  },
  head: [
    ['link', { rel: 'icon', href: '/images/app-icon-red.png' }],
    ['link', { rel: 'icon', href: '/images/app-icon-white.png', media: '(prefers-color-scheme: dark)' }],

    ['meta', { property: 'og:title', content: metadata.title }],
    ['meta', { property: 'og:description', content: metadata.description }],
    ['meta', { property: 'og:image', content: metadata.image }],
    ['meta', { property: 'og:url', content: 'https://logosdx.dev' }],
    ['meta', { property: 'og:type', content: 'website' }],

    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: metadata.title }],
    ['meta', { name: 'twitter:description', content: metadata.description }],
    ['meta', { name: 'twitter:image', content: metadata.image }],


    ['link', { rel: 'mask-icon', href: '/images/app-icon-red.png', color: '#ffffff' }],
    ['link', { rel: 'apple-touch-icon', href: '/images/app-icon-red.png', sizes: '180x180' }],

    [
      'script',
      { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-H547DPM1VY' }
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-H547DPM1VY');`
    ],

    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.0.0/css/fontawesome.min.css' }],
    ['script', { src: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.0.0/js/all.min.js' }],

  ],

}));
