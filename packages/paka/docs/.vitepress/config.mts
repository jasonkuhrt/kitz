import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '@kitz/paka',
  description:
    "Package interface extraction, docs generation, and semver impact analysis from a package's public exports.",
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Overview', link: '/overview' },
      { text: 'Quickstart', link: '/quickstart' },
      { text: 'Public API', link: '/reference/public-api' },
      { text: 'CLI', link: '/reference/cli' },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Home', link: '/' },
          { text: 'Overview', link: '/overview' },
          { text: 'Quickstart', link: '/quickstart' },
        ],
      },
      {
        text: 'Guides',
        items: [
          {
            text: 'Extract interface models',
            link: '/guides/extract-interface-models',
          },
          {
            text: 'Calculate semver from exports',
            link: '/guides/calculate-semver-from-exports',
          },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Public API', link: '/reference/public-api' },
          { text: 'CLI prototype', link: '/reference/cli' },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
  },
})
