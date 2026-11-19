// Builds the static site into dist/. No dependencies: `node build.mjs`
//
// Posts live in posts/*.html: a front-matter block, an optional excerpt, then the body HTML.
// Posts with `draft: true` are only built when INCLUDE_DRAFTS=1 or on a Cloudflare Pages
// preview branch (any branch other than "main").
import fs from 'node:fs'
import path from 'node:path'

const SITE = {
  title: 'Mike Kirkup',
  feedTitle: 'Mike Kirkup Blog RSS Feed',
  description: 'Personal blog by Mike Kirkup',
  url: 'https://mikekirkup.com',
  buttondown: 'mkirkup'
}
const ROOT = path.dirname(new URL(import.meta.url).pathname)
const OUT = path.join(ROOT, 'dist')
// Cloudflare Pages sets CF_PAGES_BRANCH; Workers Builds sets WORKERS_CI_BRANCH.
const branch = process.env.CF_PAGES_BRANCH || process.env.WORKERS_CI_BRANCH
const includeDrafts = process.env.INCLUDE_DRAFTS === '1' || (branch && branch !== 'main')

// ---------- helpers ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const stripTags = h => h.replace(/<br\s*\/?>/g, ' ').replace(/<\/p>\s*<p>/g, ' ').replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim()
const cdata = s => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th')
const prettyDate = d => `${MONTHS[d.getUTCMonth()]} ${ordinal(d.getUTCDate())}, ${d.getUTCFullYear()}`
const write = (rel, content) => {
  const file = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(file), {recursive: true})
  fs.writeFileSync(file, content)
}

// ---------- load posts ----------
function parsePost (file) {
  const raw = fs.readFileSync(file, 'utf8')
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) throw new Error(`${file}: missing front matter`)
  const meta = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  for (const k of ['title', 'date', 'slug']) if (!meta[k]) throw new Error(`${file}: missing ${k}`)
  if (meta.image && !meta.alt) throw new Error(`${file}: image needs alt text`)
  let body = m[2]
  let excerptHtml = ''
  const ex = body.match(/<!-- excerpt -->\n?([\s\S]*?)\n?<!-- \/excerpt -->\n*/)
  if (ex) { excerptHtml = ex[1].trim(); body = body.replace(ex[0], '') }
  const date = new Date(meta.date)
  if (isNaN(date)) throw new Error(`${file}: bad date`)
  const ym = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  const urlPath = `/blog/${ym}/${meta.slug}/`
  if (!excerptHtml) excerptHtml = (body.match(/<p>[\s\S]*?<\/p>/) || [''])[0]
  return {...meta, draft: meta.draft === 'true', date, urlPath, url: SITE.url + urlPath,
    body: body.trim(), excerptHtml, excerptText: stripTags(excerptHtml)}
}

const all = fs.readdirSync(path.join(ROOT, 'posts')).filter(f => f.endsWith('.html'))
  .map(f => parsePost(path.join(ROOT, 'posts', f)))
const posts = all.filter(p => includeDrafts || !p.draft).sort((a, b) => b.date - a.date)
const seen = new Set()
for (const p of posts) { if (seen.has(p.urlPath)) throw new Error(`duplicate URL ${p.urlPath}`); seen.add(p.urlPath) }

// ---------- templates ----------
const head = ({title, description, image, type = 'website'}) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${type}">
${image ? `<meta property="og:image" content="${esc(SITE.url + image)}">\n` : ''}<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.feedTitle)}" href="/rss.xml">
<link rel="stylesheet" href="/site.css">
</head>
<body>`

const header = `<div class="header__root">
<div class="header__wrapper">
<div class="header__branding"><a href="/">${esc(SITE.title)}</a></div>
<button class="header__toggleNavButton" aria-label="Menu" onclick="document.querySelector('.header__nav').classList.toggle('header__showNav')"><svg viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em"><path d="M5 7.5H20" stroke="currentColor"/><path d="M5 12.5H20" stroke="currentColor"/><path d="M5 17.5H20" stroke="currentColor"/></svg></button>
<nav class="header__nav"><ul><li><a href="/archive/">Archive</a></li></ul></nav>
</div>
</div>`

const footer = `<footer class="layout__footer">
<div class="layout__footerWrapper">
<div class="layout__siteInfo">Co-founder of <a href="https://www.elderella.com/">Elderella</a></div>
<div class="layout__siteInfo">&copy; ${new Date().getFullYear()} Mike Kirkup</div>
</div>
</footer>
</div></div>
<script>
document.querySelectorAll('form[data-buttondown]').forEach(function (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault()
    var box = form.parentNode, btn = form.querySelector('button')
    btn.disabled = true
    fetch(form.action, {method: 'POST', body: new URLSearchParams(new FormData(form))})
      .then(function (r) { if (!r.ok) throw r; box.innerHTML = '<div class="newsletter-signup__successMessage">Thanks for subscribing! Check your email to confirm.</div>' })
      .catch(function () { btn.disabled = false; var m = box.querySelector('.newsletter-signup__errorMessage') || box.insertBefore(document.createElement('div'), form); m.className = 'newsletter-signup__errorMessage'; m.textContent = 'Something went wrong. Please try again.' })
  })
})
</script>
</body>
</html>
`

const signup = compact => `<div class="newsletter-signup__newsletterSignup${compact ? ' newsletter-signup__compact' : ''}">
<div class="newsletter-signup__container">
${compact ? '' : '<h3 class="newsletter-signup__title">Subscribe to updates</h3>\n'}<p class="newsletter-signup__description">${compact ? 'Get new posts in your inbox:' : 'Get new posts delivered directly to your inbox'}</p>
<form class="newsletter-signup__form" data-buttondown method="post" action="https://buttondown.email/api/emails/embed-subscribe/${SITE.buttondown}">
<input type="email" name="email" placeholder="Enter your email" class="newsletter-signup__input" required>
<button type="submit" class="newsletter-signup__button">Subscribe</button>
</form>
${compact ? '' : '<p class="newsletter-signup__privacy">No spam, unsubscribe anytime.</p>\n'}</div>
</div>`

// The two wrapper divs match the old Gatsby structure the CSS height rules expect.
const page = (meta, content) => `${head(meta)}
<div class="site"><div class="site__inner">
${header}
<div class="layout__content">
${content}
</div>
${footer}`

const preview = (p, variant) => `<li><a class="blog-post-preview__${variant} blog-post-preview__root" href="${p.urlPath}">
<div class="blog-post-preview__leadMediaThumb">${p.image ? `<img src="${p.image}" alt="${esc(p.alt)}" loading="lazy">` : ''}</div>
<div class="blog-post-preview__text">
<h3 class="typography__responsiveTitle3 blog-post-preview__title">${p.draft ? '[DRAFT] ' : ''}${esc(p.title)}</h3>
<div class="blog-post-preview__excerpt">${p.excerptHtml}</div>
<div class="blog-post-preview__date">${prettyDate(p.date)}</div>
</div>
</a></li>`

// ---------- build ----------
fs.rmSync(OUT, {recursive: true, force: true})
fs.cpSync(path.join(ROOT, 'static'), OUT, {recursive: true})

write('index.html', page({title: SITE.title, description: SITE.description}, `<div class="container__root">
<h1 hidden>Welcome to ${esc(SITE.title)}</h1>
${signup(true)}
<div class="blog-post-preview-list__root">
<h2 class="blog-post-preview-list__headline">Latest blog posts</h2>
<ul class="blog-post-preview-list__grid">
${posts.slice(0, 6).map(p => preview(p, 'inList')).join('\n')}
</ul>
<div class="blog-post-preview-list__browseMoreNav typography__small"><a href="/archive/">Browse more</a></div>
</div>
</div>`))

write('archive/index.html', page({title: `Archive | ${SITE.title}`, description: SITE.description}, `<div class="container__root">
<h1 class="typography__responsiveTitle1">Archive</h1>
<div class="blog-post-preview-grid__root">
<ul class="blog-post-preview-grid__grid">
${posts.map(p => preview(p, 'inGrid')).join('\n')}
</ul>
</div>
</div>`))

for (const p of posts) {
  write(p.urlPath + 'index.html', page({title: `${p.title} | ${SITE.title}`, description: p.excerptText, image: p.image, type: 'article'}, `<article class="blog-post__root">
${p.image ? `<div class="blog-post__mainImage"><img src="${p.image}" alt="${esc(p.alt)}"></div>\n` : ''}<div class="container__root">
<div class="blog-post__grid">
<div class="blog-post__mainContent">
<h1 class="blog-post__title typography__responsiveTitle1">${p.draft ? '[DRAFT] ' : ''}${esc(p.title)}</h1>
<div>
${p.body}
</div>
${signup(false)}
</div>
<aside class="blog-post__metaContent">
<div class="blog-post__publishedAt typography__small">${prettyDate(p.date)}</div>
</aside>
</div>
</div>
</article>`))
}

write('404.html', page({title: `404: Not found | ${SITE.title}`, description: SITE.description}, `<div class="container__root">
<h1 class="typography__responsiveTitle1">Not found</h1>
<p>This page doesn't exist. Try the <a href="/archive/">archive</a>.</p>
</div>`))

// RSS: same shape and GUIDs as the old Gatsby feed, so the Buttondown job treats posts as already known.
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0"><channel><title>${cdata(SITE.feedTitle)}</title><description>${cdata(SITE.description)}</description><link>${SITE.url}/</link><atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${
  posts.filter(p => !p.draft).map(p => `<item><title>${cdata(p.title)}</title><description>${cdata(p.excerptText)}</description><link>${p.url}</link><guid isPermaLink="false">${p.url}</guid><pubDate>${p.date.toUTCString()}</pubDate><content:encoded>${cdata(p.body)}</content:encoded></item>`).join('')
}</channel></rss>`)

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE.url}/</loc></url>
<url><loc>${SITE.url}/archive/</loc></url>
${posts.filter(p => !p.draft).map(p => `<url><loc>${p.url}</loc><lastmod>${p.date.toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}
</urlset>
`)
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`)

console.log(`Built ${posts.length} posts (${posts.filter(p => p.draft).length} drafts) into dist/`)
