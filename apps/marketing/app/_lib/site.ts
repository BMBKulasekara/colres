/**
 * Site-wide configuration: URLs into the web app and the navigation model.
 * Every CTA reads from here so a domain change is a one-line edit.
 */

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002').replace(/\/$/, '');

export const siteConfig = {
  name: 'Colres',
  title: 'Colres · Collaborative research writing',
  description:
    'The real-time editor for academic writing. Start from IEEE, APA or ACM templates, cite as you type, and see every page exactly as it will print. Totally free.',
  url: siteUrl,
  appUrl,
} as const;

export const links = {
  signUp: `${appUrl}/sign-up`,
  signIn: `${appUrl}/sign-in`,
  docs: `${appUrl}/docs`,
  templateLibrary: `${appUrl}/docs/templates`,
  features: '#features',
  templates: '#templates',
  pricing: '#pricing',
  faq: '#faq',
  about: '/about',
  terms: '/terms',
} as const;

export const ctaLabels = {
  primary: "Start writing, it's free",
  secondary: 'Browse templates',
} as const;

export interface NavLink {
  label: string;
  href: string;
}

export const mainNav: NavLink[] = [
  { label: 'Features', href: links.features },
  { label: 'Templates', href: links.templates },
  { label: 'Pricing', href: links.pricing },
  { label: 'FAQ', href: links.faq },
  { label: 'Docs', href: links.docs },
  { label: 'About', href: links.about },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: links.features },
      { label: 'Templates', href: links.templates },
      { label: 'Pricing', href: links.pricing },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: links.docs },
      { label: 'IEEE template', href: links.templates },
      { label: 'APA 7 template', href: links.templates },
      { label: 'FAQ', href: links.faq },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: links.about },
      { label: 'Terms & Conditions', href: links.terms },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: links.signIn },
      { label: 'Create account', href: links.signUp },
    ],
  },
];

/**
 * In-page anchors like `#pricing` only resolve on the home page. Sub-pages use
 * these copies, which point back at the home page's sections instead.
 */
const fromSubPage = (link: NavLink): NavLink =>
  link.href.startsWith('#') ? { ...link, href: `/${link.href}` } : link;

export const subPageNav: NavLink[] = mainNav.map(fromSubPage);

export const subPageFooterNav: typeof footerNav = footerNav.map((group) => ({
  ...group,
  links: group.links.map(fromSubPage),
}));
