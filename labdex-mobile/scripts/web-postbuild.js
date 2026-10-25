// Runs after `expo export --platform web`. Tunes dist/index.html for phones (iPhone Safari especially):
// no zoom-in when tapping an input, safe areas around the notch and home bar, a full-height layout that
// follows Safari's moving toolbar, and an icon + name for "Add to Home Screen".
const fs = require('fs')
const path = require('path')

const dist = path.join(__dirname, '..', 'dist')
const file = path.join(dist, 'index.html')
let html = fs.readFileSync(file, 'utf8')

html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">'
)

const head = `
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="LabDex">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="manifest" href="/manifest.json">
    <style>
      html, body { background: #F4F1E8; }
      @media (prefers-color-scheme: dark) { html, body { background: #151410; } }
      /* dvh follows Safari's collapsing toolbar, so the bottom bar never hides behind it. */
      #root { height: 100vh; height: 100dvh; }
      body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
    </style>`
// Safari paints the status bar / toolbar in theme-color: match the paper, and the night register in dark mode.
html = html.replace(/<meta name="theme-color"[^>]*>/, '')
html = html.replace(
  '</head>',
  `${head}
    <meta name="theme-color" content="#F4F1E8" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#151410" media="(prefers-color-scheme: dark)">
  </head>`
)
fs.writeFileSync(file, html)

fs.copyFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), path.join(dist, 'apple-touch-icon.png'))
fs.writeFileSync(
  path.join(dist, 'manifest.json'),
  JSON.stringify(
    {
      name: 'LabDex',
      short_name: 'LabDex',
      start_url: '/log',
      display: 'standalone',
      background_color: '#F4F1E8',
      theme_color: '#F4F1E8',
      icons: [{ src: '/apple-touch-icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }]
    },
    null,
    2
  )
)
console.log('web-postbuild: index.html tuned for phones, manifest + home-screen icon written')
