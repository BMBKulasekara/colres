'use client';

import { useOrganization } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { useQuery } from 'convex/react';
import { ArrowLeft, FilePlus2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CreateDocumentWizard } from '../../../components/templates/CreateDocumentWizard';
import { TemplateCard } from '../../../components/templates/TemplateCard';
import { TemplatePreviewDialog } from '../../../components/templates/TemplatePreviewDialog';

export default function TemplateGalleryPage() {
  const { organization } = useOrganization();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Set when the author commits to a template; opens the wizard on its details
  // step with that template already chosen.
  const [creatingFrom, setCreatingFrom] = useState<string | null>(null);

  const categories = useQuery(api.templates.listCategories, {});
  const templates = useQuery(api.templates.listTemplates, {
    category: (category ?? undefined) as never,
    search: search.trim() || undefined,
    tag: tag ?? undefined,
    orgId: organization?.id,
  });

  // Tag filters are derived from what is actually in the gallery rather than
  // from a fixed list, so admin-added templates contribute their own.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const template of templates ?? []) {
      for (const t of template.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 14)
      .map(([name]) => name);
  }, [templates]);

  const activeCategory = categories?.find((c) => c.slug === category);

  return (
    <div className="min-h-screen w-full bg-background/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
            <Link href="/docs">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to documents
            </Link>
          </Button>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Templates
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Start from a structure that matches where you intend to submit. Each template seeds the
            right sections, word budgets, and citation style — you can change any of it later.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 shrink-0">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              <CategoryLink
                label="All templates"
                active={category === null}
                onClick={() => setCategory(null)}
              />
              {categories === undefined
                ? [1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-lg shrink-0" />
                  ))
                : categories.map((c) => (
                    <CategoryLink
                      key={c.slug}
                      label={c.name}
                      active={category === c.slug}
                      onClick={() => setCategory(c.slug)}
                    />
                  ))}
            </nav>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 mb-4">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, publisher, document class, or tag..."
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {allTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTag(tag === t ? null : t)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      tag === t
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {activeCategory?.description && (
              <p className="text-sm text-muted-foreground mb-5 border-l-2 border-primary/40 pl-3">
                {activeCategory.description}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => setCreatingFrom('__blank__')}
                className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 p-4 min-h-[200px]"
              >
                <div className="h-11 w-11 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <FilePlus2 className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <span className="text-sm font-bold text-foreground">Blank document</span>
                <span className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  An empty page with no structure.
                </span>
              </button>

              {templates === undefined
                ? [1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <Skeleton key={i} className="rounded-xl min-h-[200px]" />
                  ))
                : templates.map((template) => (
                    <TemplateCard
                      key={template._id}
                      template={template as never}
                      selected={false}
                      onSelect={() => setCreatingFrom(template._id)}
                      onPreview={() => setPreviewId(template._id)}
                    />
                  ))}
            </div>

            {templates?.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">
                No templates match those filters.
              </p>
            )}
          </div>
        </div>
      </div>

      <TemplatePreviewDialog
        templateId={previewId}
        onOpenChange={(next) => !next && setPreviewId(null)}
        onUse={(id) => {
          setPreviewId(null);
          setCreatingFrom(id);
        }}
      />

      {creatingFrom && (
        <CreateDocumentWizard
          // Remounting per selection is what lets the wizard seed its state
          // from `initialTemplateId` for each different template.
          key={creatingFrom}
          open
          onOpenChange={(next) => !next && setCreatingFrom(null)}
          initialTemplateId={creatingFrom === '__blank__' ? null : creatingFrom}
        />
      )}
    </div>
  );
}

function CategoryLink({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
        active
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
