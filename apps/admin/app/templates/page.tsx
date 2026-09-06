'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import {
  IconAlertTriangle,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconLayoutGrid,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AppSidebar } from '../../components/app-sidebar';
import { SiteHeader } from '../../components/side-header';

export default function TemplatesPage() {
  const router = useRouter();
  const templates = useQuery(api.templates.adminListTemplates, {});
  const categories = useQuery(api.templates.adminListCategories, {});

  const createTemplate = useMutation(api.templates.adminCreateTemplate);
  const setStatus = useMutation(api.templates.adminSetTemplateStatus);
  const duplicate = useMutation(api.templates.adminDuplicateTemplate);
  const remove = useMutation(api.templates.adminDeleteTemplate);
  const reseed = useMutation(api.seedTemplates.adminReseedCatalog);

  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{
    _id: string;
    name: string;
    usageCount: number;
  } | null>(null);
  const [isReseeding, setIsReseeding] = useState(false);

  const loading = templates === undefined;

  const filtered = (templates ?? []).filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [t.name, t.slug, t.category, t.publisher ?? '', ...t.tags]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const categoryName = (slug: string) => categories?.find((c) => c.slug === slug)?.name ?? slug;

  const handleCreate = async () => {
    try {
      // A minimal published-ready shell; everything else is filled in on the
      // edit screen, which is where the real authoring happens.
      const id = await createTemplate({
        name: 'New template',
        category: 'journal-articles',
        description: 'Describe what this template is for.',
        tags: [],
        official: false,
        content: '<h1>{{TITLE}}</h1><h2>Introduction</h2><p></p>',
        sections: [{ key: 'introduction', title: 'Introduction', required: true }],
        fields: [],
        engine: 'pdflatex',
        bibTool: 'biber',
        passes: 3,
        entryFile: 'main.tex',
        documentClass: 'article',
        classOptions: [],
        requiredPackages: [],
        citationStyle: 'numeric',
        license: {
          spdx: 'LPPL-1.3c',
          url: 'https://www.latex-project.org/lppl/',
          redistributable: true,
        },
        status: 'draft',
        featured: false,
        order: (templates?.length ?? 0) + 1,
      });
      toast.success('Template created as a draft');
      router.push(`/templates/${id}`);
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not create the template');
    }
  };

  const handleToggleStatus = async (id: string, current: 'draft' | 'published') => {
    setBusyId(id);
    try {
      await setStatus({ id: id as never, status: current === 'published' ? 'draft' : 'published' });
      toast.success(current === 'published' ? 'Unpublished' : 'Published to the gallery');
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not change the status');
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      const newId = await duplicate({ id: id as never });
      toast.success('Duplicated as a draft');
      router.push(`/templates/${newId}`);
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not duplicate the template');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting._id);
    try {
      await remove({ id: deleting._id as never });
      toast.success('Template deleted');
      setDeleting(null);
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not delete the template');
    } finally {
      setBusyId(null);
    }
  };

  const handleReseed = async () => {
    setIsReseeding(true);
    try {
      const result = await reseed({});
      toast.success(
        `Catalog synced — ${result.templatesCreated} added, ${result.templatesSkipped} already present`
      );
    } catch (error: any) {
      toast.error(error?.message ?? 'Could not sync the catalog');
    } finally {
      setIsReseeding(false);
    }
  };

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />

        <div className="flex-1 flex flex-col p-6 space-y-6">
          <Toaster richColors position="top-right" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <IconLayoutGrid className="text-primary w-7 h-7" />
                Template Management
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Create, edit, and publish the document templates users can start from.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleReseed}
                disabled={isReseeding}
                title="Add any built-in templates that are missing from this deployment"
                className="cursor-pointer"
              >
                {isReseeding ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconRefresh size={16} />
                )}
                Sync built-ins
              </Button>
              <Button onClick={handleCreate} className="cursor-pointer font-semibold">
                <IconPlus size={16} />
                New template
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 max-w-md w-full bg-card rounded-lg border border-border px-3 py-2">
            <IconSearch className="text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, slug, category, or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder-muted-foreground"
            />
          </div>

          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                <IconLoader2 className="animate-spin text-primary w-10 h-10" />
                <span className="text-sm text-muted-foreground">Loading templates...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center gap-2">
                <IconAlertTriangle className="text-muted-foreground w-10 h-10" />
                <h3 className="font-semibold text-lg">No templates found</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {search
                    ? 'Try adjusting your search.'
                    : 'Create one, or sync the built-in catalog.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold">Name</TableHead>
                    <TableHead className="font-bold">Category</TableHead>
                    <TableHead className="font-bold">Class</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold text-right">Used</TableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((template) => (
                    <TableRow key={template._id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="max-w-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground truncate flex items-center gap-1.5">
                            {template.name}
                            {template.featured && (
                              <span className="text-[9px] font-bold uppercase text-amber-500">
                                Featured
                              </span>
                            )}
                            {template.official && (
                              <span className="text-[9px] font-bold uppercase text-primary">
                                {template.publisher ?? 'Official'}
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono truncate">
                            /{template.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {categoryName(template.category)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{template.documentClass}</TableCell>
                      <TableCell>
                        {template.status === 'published' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Draft
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono text-muted-foreground">
                        {template.usageCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            title={template.status === 'published' ? 'Unpublish' : 'Publish'}
                            disabled={busyId === template._id}
                            onClick={() => handleToggleStatus(template._id, template.status)}
                          >
                            {template.status === 'published' ? (
                              <IconEyeOff size={14} />
                            ) : (
                              <IconEye size={14} />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            title="Duplicate"
                            disabled={busyId === template._id}
                            onClick={() => handleDuplicate(template._id)}
                          >
                            <IconCopy size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            title="Edit"
                            onClick={() => router.push(`/templates/${template._id}`)}
                          >
                            <IconPencil size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                            title="Delete"
                            onClick={() =>
                              setDeleting({
                                _id: template._id,
                                name: template.name,
                                usageCount: template.usageCount,
                              })
                            }
                          >
                            <IconTrash size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="max-w-md bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-red-500">
                <IconAlertTriangle />
                Delete template
              </DialogTitle>
              <DialogDescription>
                Documents already created from this template keep their content and formatting
                settings — only the link back to the template is removed.
              </DialogDescription>
            </DialogHeader>

            {deleting && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 my-2">
                <h4 className="font-semibold text-foreground text-sm">{deleting.name}</h4>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Used by {deleting.usageCount} document{deleting.usageCount === 1 ? '' : 's'}.
                </p>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setDeleting(null)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={busyId === deleting?._id}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold cursor-pointer"
              >
                {busyId === deleting?._id && <IconLoader2 className="animate-spin w-4 h-4" />}
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
