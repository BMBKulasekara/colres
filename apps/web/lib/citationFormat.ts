/**
 * Display formatting for reference lists.
 *
 * Presentation only — key generation and BibTeX live on the backend, where the
 * export needs them. These are readable approximations of each style, not
 * byte-exact reproductions of a .bst file; the authoritative rendering happens
 * when the document is compiled by the publisher's own class.
 */

export interface DisplayReference {
  citationKey: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  publisher?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
}

export type CitationStyle = 'ieee' | 'apa' | 'acm' | 'vancouver' | 'chicago' | 'numeric';

function surname(author: string): string {
  const name = author.trim();
  if (name.includes(',')) return name.split(',')[0]?.trim() ?? name;
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function initials(author: string): string {
  const name = author.trim();
  const given = name.includes(',')
    ? (name.split(',')[1] ?? '').trim()
    : name.split(/\s+/).slice(0, -1).join(' ');

  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase()}.`)
    .join(' ');
}

/** "A. Vaswani, N. Shazeer, et al." — the IEEE/Vancouver shape. */
function initialsFirst(authors: string[], max = 6): string {
  if (authors.length === 0) return 'Unknown author';
  const shown = authors.slice(0, max).map((a) => {
    const i = initials(a);
    return i ? `${i} ${surname(a)}` : surname(a);
  });
  return authors.length > max ? `${shown.join(', ')}, et al.` : shown.join(', ');
}

/** "Vaswani, A., & Shazeer, N." — the APA shape. */
function surnameFirst(authors: string[], max = 20): string {
  if (authors.length === 0) return 'Unknown author';
  const shown = authors.slice(0, max).map((a) => {
    const i = initials(a);
    return i ? `${surname(a)}, ${i}` : surname(a);
  });
  if (shown.length === 1) return shown[0] as string;
  const last = shown.pop();
  return `${shown.join(', ')}, & ${last}`;
}

function withPeriod(value: string): string {
  return value.endsWith('.') ? value : `${value}.`;
}

/** Renders one entry. The leading "[n]" for numbered styles is added by the
 * caller, so it can align the list and keep numbering in one place. */
export function formatReference(reference: DisplayReference, style: CitationStyle): string {
  const { title, authors, year, venue, volume, number, pages, publisher } = reference;
  const y = year ? String(year) : 'n.d.';

  switch (style) {
    case 'apa': {
      const parts = [
        withPeriod(surnameFirst(authors)),
        `(${y}).`,
        withPeriod(title),
        venue
          ? `${venue}${volume ? `, ${volume}` : ''}${number ? `(${number})` : ''}${pages ? `, ${pages}` : ''}.`
          : '',
        publisher && !venue ? withPeriod(publisher) : '',
      ];
      return parts.filter(Boolean).join(' ');
    }

    case 'chicago': {
      const parts = [
        withPeriod(surnameFirst(authors)),
        `"${withPeriod(title)}"`,
        venue ? `${venue}${volume ? ` ${volume}` : ''}${number ? `, no. ${number}` : ''}` : '',
        `(${y})`,
        pages ? `: ${pages}.` : '.',
      ];
      return parts.filter(Boolean).join(' ');
    }

    case 'acm': {
      const parts = [
        withPeriod(initialsFirst(authors)),
        `${y}.`,
        withPeriod(title),
        venue ? `${venue}${volume ? ` ${volume}` : ''}${number ? `, ${number}` : ''}` : '',
        pages ? `, ${pages}.` : '',
      ];
      return parts.filter(Boolean).join(' ');
    }

    case 'vancouver': {
      const parts = [
        withPeriod(initialsFirst(authors, 6)),
        withPeriod(title),
        venue ? `${venue}.` : '',
        `${y}`,
        volume ? `;${volume}` : '',
        number ? `(${number})` : '',
        pages ? `:${pages}` : '',
      ];
      return `${parts.filter(Boolean).join(' ')}.`;
    }

    // IEEE and the generic numeric style share a shape; the leading [n] is
    // added by the caller so it can align the list.
    default: {
      const parts = [
        `${initialsFirst(authors)},`,
        `"${withPeriod(title)}"`,
        venue ? `${venue},` : '',
        volume ? `vol. ${volume},` : '',
        number ? `no. ${number},` : '',
        pages ? `pp. ${pages},` : '',
        `${y}.`,
      ];
      return parts.filter(Boolean).join(' ');
    }
  }
}

/** Styles that number their entries rather than using author-date. */
export function isNumberedStyle(style: CitationStyle): boolean {
  return style === 'ieee' || style === 'numeric' || style === 'acm' || style === 'vancouver';
}
