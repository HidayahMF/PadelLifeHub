# Public Landing Website

LifeHub ships with a public, SEO-ready marketing website in addition to the
authenticated application. It keeps the same neo-brutalist design system
(thick borders, offset shadows, `font-display`, Light/Dark/System themes) so
the marketing site feels like one product with the app.

---

## 1. Public routes

| Route      | Page                          | Auth  |
| ---------- | ----------------------------- | ----- |
| `/`        | Main landing page             | Public |
| `/features`| Full feature overview         | Public |
| `/ai`      | LifeHub AI (marketing page)   | Public |
| `/about`   | About the project             | Public |
| `/contact` | Contact / developer           | Public |
| `/login`   | Existing login page           | Public (guest-only) |
| `/register`| Existing register page        | Public (guest-only) |

The authenticated application moved under `/app`:

| Route             | Page                          |
| ----------------- | ----------------------------- |
| `/app/today`      | Today                         |
| `/app/dashboard`  | Dashboard                     |
| `/app/ai`         | LifeHub AI (the real feature) |
| `/app/tasks`, `/app/finance`, `/app/wishlist`, `/app/needs`, `/app/calendar`, `/app/goals`, `/app/habits`, `/app/notes`, `/app/pomodoro`, `/app/statistics`, `/app/weekly-review`, `/app/settings`, `/app/profile`, `/app/help` | Existing features |

Notes:

- `authGuard` protects everything under `/app`; `guestGuard` keeps
  `/login` and `/register` away from authenticated users.
- Unknown URLs redirect to `/` (the landing page).
- The public `/ai` page shows product information and, when the visitor is
  already signed in, its CTA links straight to `/app/ai`.

### Source files

```
frontend/src/app/features/public/
├── landing/       landing.component.ts        ( / )
├── features/      features.component.ts       ( /features )
├── ai-landing/    ai-landing.component.ts     ( /ai )
├── about/         about.component.ts          ( /about )
├── contact/       contact.component.ts        ( /contact )
└── shared/
    ├── public-navbar.component.ts
    └── public-footer.component.ts
```

The navbar/footer read auth state and the theme service, so the "Log in /
Get Started" actions become "Open LifeHub" for signed-in users, and the
theme toggle follows the app's Light/Dark/System preference.

---

## 2. SEO configuration

Each public page sets its own unique metadata at runtime via
`frontend/src/app/core/services/seo.service.ts` (title, meta description,
canonical URL, Open Graph, Twitter card). The defaults live in
`frontend/src/index.html` so crawlers get sensible tags even before Angular
boots.

| Page      | Title                                        |
| --------- | -------------------------------------------- |
| `/`       | LifeHub — Personal Life Management & Productivity App |
| `/features`| Features — LifeHub                          |
| `/ai`     | LifeHub AI — Personal Productivity & Finance Assistant |
| `/about`  | About LifeHub — The Story Behind the Platform |
| `/contact`| Contact — LifeHub                            |

`index.html` also includes JSON-LD structured data (`SoftwareApplication`
and `WebSite`).

> Note: this is a client-side-rendered Angular app, so meta tags are set in
> the browser. For full crawlability of every route consider adding
> prerendering/SSR (`@angular/ssr` or `ngx-deploy`-style prerender) later —
> the canonical/OG tags will then be emitted server-side automatically.

---

## 3. Open Graph / social preview

Default OG + Twitter tags (title, description, image, url, type) are in
`index.html` and refreshed per page by the SEO service. The shared image is:

```
https://lifehub-psi-two.vercel.app/assets/og-image.png   (1200×630)
```

The image is generated from `frontend/scripts/generate-og-image.cjs`:

```bash
cd frontend
npx playwright install chromium   # once, if needed
node scripts/generate-og-image.cjs
```

Re-run it after any brand change. It overwrites `frontend/assets/og-image.png`.

---

## 4. Sitemap + robots

- `frontend/public/sitemap.xml` — lists only public pages
  (`/`, `/features`, `/ai`, `/about`, `/contact`, `/login`, `/register`).
- `frontend/public/robots.txt` — allows public pages and **disallows `/app/`**
  so authenticated routes never appear in search results.

Both files live in `frontend/public/` and are copied to the output root by
Angular automatically.

---

## 5. Environment / social configuration

Edit `frontend/src/app/core/config/site.config.ts`:

```ts
export const SITE = {
  name: 'LifeHub',
  tagline: 'Personal Life Management Platform',
  url: environment.siteUrl,          // ← base URL for canonical/OG tags
  developer: { name: 'Hidayah Muhammad Fadillah', role: 'Full-stack Developer' },
  social: {
    github:    { label: 'GitHub',    url: 'https://github.com/HidayahMF',    icon: 'assets/githublogo.png' },
    linkedin:  { label: 'LinkedIn',  url: 'https://www.linkedin.com/in/hidayah-muhammad-fadillah-89695b384/', icon: 'assets/linkedinlogo.png' },
    instagram: { label: 'Instagram', url: 'https://www.instagram.com/hdyhmfdlh/', icon: 'assets/instagramlogo.png' },
    tiktok:    { label: 'TikTok',    url: 'https://www.tiktok.com/@padelqt', icon: 'assets/tiktoklogo.png' },
  },
};
```

Each entry has a `url` and a brand `icon` (a logo image in
`frontend/assets/`). The footer renders square icon buttons and the Contact
page renders cards using those images — swap the file in `assets/` and update
`icon` to change them. Only entries with a non-empty `url` are rendered.

---

## 6. Changing the domain

1. Update `siteUrl` in `frontend/src/environments/environment.ts` (dev) and
   `environment.production.ts` (prod).
2. Update the canonical/OG URLs in `frontend/src/index.html`.
3. Update the `<loc>` URLs in `frontend/public/sitemap.xml` and the
   `Sitemap:` line in `frontend/public/robots.txt`.

---

## 7. Performance & accessibility notes

- All public pages are lazy-loaded standalone components (no new runtime
  dependency; icons reuse the existing `@lucide/angular` set).
- No analytics/tracking was added.
- Semantic HTML (`header/nav/main/section/footer`, real `<a>` links), proper
  heading hierarchy, focus-visible states, `aria-label`/`aria-current` on
  nav items, and an Esc-closable keyboard-usable mobile menu.

---

## 8. Verification checklist

- Public pages render without auth and without hitting the backend.
- `/app/...` routes redirect to `/login` when signed out and work when signed in.
- Google Login, JWT, register, logout unaffected.
- Dark mode works on every public page (same CSS variables as the app).
- No horizontal scroll at 320–1440px widths.
- `npm run build` passes; `npm test` passes.
