/**
 * Who runs Colres and how to reach them. The About and Terms pages read
 * everything personal or legal from here, so updating a name, an email or the
 * governing law is a one-file edit.
 *
 * TODO before launch: replace the developer's display name and bio with the
 * real ones, add LinkedIn / website links, and confirm `legal` with whoever
 * operates Colres. Optional fields left undefined are simply not rendered.
 */

const repoUrl = 'https://github.com/BMBKulasekara/colres';

export interface Developer {
  name: string;
  role: string;
  bio: string;
  /** Path under /public, e.g. '/team/name.jpg'. Initials are shown without it. */
  photo?: string;
  github?: string;
  linkedin?: string;
  website?: string;
}

export const developers: Developer[] = [
  {
    name: 'BMBKulasekara',
    role: 'Creator & full-stack developer',
    bio: 'Designed and built Colres end to end: the writing editor, the real-time backend, the admin console and this site.',
    github: 'https://github.com/BMBKulasekara',
  },
];

export const contact = {
  email: 'support@colres.app',
  github: repoUrl,
  issues: `${repoUrl}/issues`,
  /** Shown only when set. */
  phone: undefined as string | undefined,
  location: undefined as string | undefined,
} as const;

export const legal = {
  /** The person or organisation that operates Colres, as named in the Terms. */
  operator: 'the Colres team',
  /** Country whose law governs the Terms. Shown only when set. */
  governingLaw: undefined as string | undefined,
  minimumAge: 13,
  lastUpdated: '4 October 2026',
} as const;
