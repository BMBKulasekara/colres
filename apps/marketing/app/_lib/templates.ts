/**
 * Marketing view of the built-in template catalog.
 *
 * Import only from Server Components: the catalog carries full document
 * skeletons, and only the small `GalleryTemplate` shape should reach the client.
 */
import { templateCatalog } from '@repo/convex/templates/catalog';

/** Which miniature page a template card draws. */
export type ThumbLayout = 'two-column' | 'title-page' | 'single' | 'chapters';

export interface GalleryTemplate {
  slug: string;
  name: string;
  category: string;
  meta: string;
  layout: ThumbLayout;
  badge?: 'Popular' | 'New';
}

export interface GalleryCategory {
  slug: string;
  name: string;
}

const citationLabels: Record<string, string> = {
  ieee: 'IEEE citations',
  apa: 'author–date',
  acm: 'ACM citations',
  vancouver: 'Vancouver citations',
  chicago: 'Chicago citations',
  numeric: 'numeric citations',
};

/** Hand-tuned card copy for templates whose catalog description is too long for a card. */
const presentation: Record<
  string,
  Partial<Pick<GalleryTemplate, 'name' | 'meta' | 'layout' | 'badge'>>
> = {
  'ieee-conference': {
    name: 'IEEE Conference',
    meta: 'Two-column · numeric citations',
    layout: 'two-column',
    badge: 'Popular',
  },
  'apa-student-paper': {
    name: 'APA 7 Student',
    meta: 'Title page · author–date',
    layout: 'title-page',
    badge: 'New',
  },
  'apa-professional-paper': {
    name: 'APA 7 Professional',
    meta: 'Running head · author–date',
    layout: 'title-page',
  },
  'acm-sigconf': { name: 'ACM sigconf', meta: 'Proceedings · CCS concepts', layout: 'single' },
  'thesis-dissertation': { meta: 'Chapters · front matter', layout: 'chapters' },
  'literature-review': { meta: 'Search strategy · author–date', layout: 'single' },
  'basic-article': { meta: 'IMRaD · venue-neutral', layout: 'single' },
};

const leadSlugs = ['ieee-conference', 'apa-student-paper', 'acm-sigconf', 'thesis-dissertation'];

export const templateCount = templateCatalog.templates.length;

/** Featured templates in catalog order, plus the categories they span. */
export function getGalleryData(): { templates: GalleryTemplate[]; categories: GalleryCategory[] } {
  // Spec order first (IEEE, APA 7, ACM, thesis), then the rest in catalog order.
  const rank = (slug: string) => {
    const i = leadSlugs.indexOf(slug);
    return i === -1 ? leadSlugs.length : i;
  };
  const featured = templateCatalog.templates
    .filter((t) => t.featured)
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.order - b.order);

  const templates = featured.map<GalleryTemplate>((t) => {
    const p = presentation[t.slug] ?? {};
    return {
      slug: t.slug,
      name: p.name ?? t.name,
      category: t.category,
      meta: p.meta ?? citationLabels[t.citationStyle] ?? '',
      layout: p.layout ?? 'single',
      badge: p.badge,
    };
  });

  const used = new Set(templates.map((t) => t.category));
  const categories = templateCatalog.categories
    .filter((c) => used.has(c.slug))
    .map(({ slug, name }) => ({ slug, name }));

  return { templates, categories };
}
