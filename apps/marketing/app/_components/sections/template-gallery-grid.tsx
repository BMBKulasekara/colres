'use client';

import { cn } from '@repo/ui/lib/utils';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { links } from '../../_lib/site';
import type { GalleryCategory, GalleryTemplate } from '../../_lib/templates';
import { PageThumb } from '../mockups/template-picker-mock';
import { Chip } from '../ui/chip';
import { Eyebrow } from '../ui/eyebrow';

const ALL = 'all';
/** "All" shows one clean row; the full catalog lives in the app. */
const ALL_LIMIT = 4;

interface TemplateGalleryGridProps {
  templates: GalleryTemplate[];
  categories: GalleryCategory[];
  totalCount: number;
}

export function TemplateGalleryGrid({
  templates,
  categories,
  totalCount,
}: TemplateGalleryGridProps) {
  const [filter, setFilter] = useState(ALL);
  const visible =
    filter === ALL ? templates.slice(0, ALL_LIMIT) : templates.filter((t) => t.category === filter);
  const filters = [{ slug: ALL, name: 'All' }, ...categories];

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Templates</Eyebrow>
          <h2
            id="templates-heading"
            className="mt-3 font-bold text-[32px] text-slate-900 leading-9 tracking-[-0.03em] md:text-[44px] md:leading-12"
          >
            Start in the right format
          </h2>
        </div>

        <fieldset className="-mx-5 min-w-0 overflow-x-auto px-5 lg:mx-0 lg:px-0">
          <legend className="sr-only">Filter templates by category</legend>
          <div className="flex gap-2">
            {filters.map((f) => {
              const active = filter === f.slug;
              return (
                <button
                  key={f.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.slug)}
                  className={cn(
                    'h-11 shrink-0 whitespace-nowrap rounded-full px-4 font-medium text-[13px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 md:h-8.5',
                    active
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <ul aria-live="polite" className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((t) => (
          <li key={t.slug}>
            <TemplateCard template={t} />
          </li>
        ))}
      </ul>

      <Link
        href={links.templateLibrary}
        className="group mt-10 inline-flex items-center gap-2 rounded-sm font-semibold text-indigo-600 outline-none hover:text-indigo-700 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50"
      >
        Browse all {totalCount} templates
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </>
  );
}

function TemplateCard({ template }: { template: GalleryTemplate }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-card-hover">
      <div className="relative flex h-42 justify-center overflow-hidden bg-slate-100 px-6 pt-6">
        <PageThumb
          layout={template.layout}
          className="h-44 w-34 rounded-t-sm transition-transform duration-200 group-hover:-translate-y-2"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition-[opacity,background-color] duration-200 group-focus-within:bg-slate-900/10 group-focus-within:opacity-100 group-hover:bg-slate-900/10 group-hover:opacity-100">
          <span className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-sm text-white shadow-card-hover">
            Use template
          </span>
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h3 className="font-semibold text-base text-slate-900">
            {/* Stretched link: the whole card is clickable. */}
            <Link
              href={links.signUp}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-[3px] focus-visible:after:ring-indigo-500/50"
            >
              {template.name}
            </Link>
          </h3>
          <p className="mt-1 text-slate-500 text-sm">{template.meta}</p>
        </div>
        {template.badge && (
          <Chip tone={template.badge === 'Popular' ? 'amber' : 'indigo'}>{template.badge}</Chip>
        )}
      </div>
    </article>
  );
}
