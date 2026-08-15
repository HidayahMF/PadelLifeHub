import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE } from '../config/site.config';

export interface SeoOptions {
  /** Full <title> text. */
  title: string;
  /** Meta description (unique per page). */
  description: string;
  /** Route path appended to SITE.url, e.g. '/features'. Defaults to '/'. */
  path?: string;
  /** og:type — 'website' for pages, 'software.application' for the landing. */
  type?: string;
}

const OG_IMAGE = `${SITE.url}/assets/og-image.png`;

/**
 * Sets unique, per-route SEO metadata (title, description, canonical, Open
 * Graph, Twitter card) for the public marketing pages. The tags live in
 * index.html as sensible defaults and are overwritten here on each navigation.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta = inject(Meta);
  private title = inject(Title);

  setPage(options: SeoOptions): void {
    const url = `${SITE.url}${options.path ?? '/'}`;
    const type = options.type ?? 'website';

    this.title.setTitle(options.title);
    this.meta.updateTag({ name: 'description', content: options.description });

    // Canonical — Angular's Meta service only manages <meta> elements, so the
    // <link rel="canonical"> tag is updated via the DOM directly.
    this.setCanonical(url);

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: options.title });
    this.meta.updateTag({ property: 'og:description', content: options.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:site_name', content: SITE.name });
    this.meta.updateTag({ property: 'og:image', content: OG_IMAGE });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });
    this.meta.updateTag({ property: 'og:image:alt', content: `${SITE.name} — ${SITE.tagline}` });

    // Twitter / X card
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: options.title });
    this.meta.updateTag({ name: 'twitter:description', content: options.description });
    this.meta.updateTag({ name: 'twitter:image', content: OG_IMAGE });
  }

  private setCanonical(url: string): void {
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }
}
