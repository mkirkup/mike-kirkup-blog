# mikekirkup.com

Static blog. No CMS, no framework, no dependencies: `build.mjs` turns `posts/*.html` into `dist/`.
Hosted on Cloudflare Pages (build command `node build.mjs`, output directory `dist`).

```
node build.mjs                    # production build (drafts excluded)
INCLUDE_DRAFTS=1 node build.mjs   # include drafts, marked [DRAFT]
python3 -m http.server 8787 -d dist
```

## Writing a post

Create `posts/YYYY-MM-DD-slug.html`:

```html
---
title: Post title
date: 2026-11-17T14:00:00Z
slug: post-title
image: /images/2026-11-17-post-title.jpg
alt: Description of the image (required when there is an image)
draft: true
---
<!-- excerpt -->
<p>Shown on the home page, archive, social cards, RSS description and the newsletter email.</p>
<!-- /excerpt -->

<p>Body HTML. Use &lt;h2&gt; for section headings.</p>
```

- URL is `/blog/YYYY/MM/slug/`, from the `date` (UTC). Never change the date or slug of a published post: it changes the URL and the RSS id.
- Images go in `static/images/`, 16:9, ~1200px wide.
- If there's no excerpt block, the first paragraph is used.

## Drafts and previews

`draft: true` posts are left out of production builds, but they are included on Cloudflare Pages
preview deployments (any branch other than `main`). Push a branch to get a preview URL to review.

## Publishing (and the newsletter email)

Remove `draft: true`, set `date` to now, and push to `main`.

The GitHub Action `.github/workflows/send-newsletter.yml` runs hourly at :15. It reads
`https://mikekirkup.com/rss.xml` and emails Buttondown subscribers any post whose date is within the
last 2 hours and isn't already in `.github/scripts/sent-posts.json`.
To publish **without** emailing, set `date` more than 2 hours in the past.
