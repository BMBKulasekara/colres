'use client';

import { Button } from '@repo/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
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
  IconFileDescription,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AppSidebar } from '../../components/app-sidebar';
import { SiteHeader } from '../../components/side-header';

interface Document {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: boolean;
  createdAt: number;
  updatedAt: number;
  author: string;
  authorName: string;
  authorEmail: string;
  orgId?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState(true);
  const [orgId, setOrgId] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents');
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to fetch documents');
      }
      const data = await res.json();
      setDocuments(data);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error loading documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Auto-generate slug from title
  const handleTitleChange = (val: string, _isEdit: boolean) => {
    setTitle(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug);
  };

  // Create document
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug) {
      toast.error('Title and Slug are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, content, status, orgId: orgId || undefined }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create document');
      }
      toast.success('Document created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create document');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit dialog
  const openEdit = (doc: Document) => {
    setSelectedDoc(doc);
    setTitle(doc.title);
    setSlug(doc.slug);
    setContent(doc.content);
    setStatus(doc.status);
    setOrgId(doc.orgId || '');
    setIsEditOpen(true);
  };

  // Update document
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedDoc._id, title, slug, content, status }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update document');
      }
      toast.success('Document updated successfully');
      setIsEditOpen(false);
      resetForm();
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update document');
    } finally {
      setSubmitting(false);
    }
  };

  // Open delete dialog
  const openDelete = (doc: Document) => {
    setSelectedDoc(doc);
    setIsDeleteOpen(true);
  };

  // Delete document
  const handleDelete = async () => {
    if (!selectedDoc) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents?id=${selectedDoc._id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }
      toast.success('Document deleted successfully');
      setIsDeleteOpen(false);
      resetForm();
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete document');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedDoc(null);
    setTitle('');
    setSlug('');
    setContent('');
    setStatus(true);
    setOrgId('');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Filtering
  const filteredDocs = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                <IconFileDescription className="text-primary w-7 h-7" />
                Document Management
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                View, modify, and delete collaborative text documents across all users.
              </p>
            </div>

            <Button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2 shadow-sm rounded-lg"
            >
              <IconPlus size={16} />
              Create Document
            </Button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 max-w-md w-full bg-card rounded-lg border border-border px-3 py-2">
            <IconSearch className="text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search by title, slug, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 text-sm w-full text-foreground placeholder-muted-foreground"
            />
          </div>

          {/* Documents Table */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                <IconLoader2 className="animate-spin text-primary w-10 h-10" />
                <span className="text-sm text-muted-foreground">Loading documents...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center gap-2">
                <IconAlertTriangle className="text-muted-foreground w-10 h-10" />
                <h3 className="font-semibold text-lg">No documents found</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {searchQuery
                    ? 'Try adjusting your search query or clear the filter.'
                    : 'Create your first document to get started.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold">Title</TableHead>
                    <TableHead className="font-bold">Slug</TableHead>
                    <TableHead className="font-bold">Author</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold">Created</TableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => (
                    <TableRow key={doc._id} className="hover:bg-muted/30 transition-colors">
                      <TableCell
                        className="font-medium text-foreground max-w-xs truncate"
                        title={doc.title}
                      >
                        {doc.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs truncate max-w-xs">
                        /{doc.slug}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{doc.authorName}</span>
                          <span className="text-xs text-muted-foreground">{doc.authorEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.status ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Draft
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEdit(doc)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground border-border hover:bg-muted cursor-pointer"
                            title="Edit Document"
                          >
                            <IconPencil size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openDelete(doc)}
                            className="h-8 w-8 text-red-500 hover:text-red-600 border-border hover:bg-red-500/10 cursor-pointer"
                            title="Delete Document"
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

        {/* Create Document Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-lg bg-card border border-border">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Create Document</DialogTitle>
                <DialogDescription>
                  Initialize a new document canvas. Administrative creates are mapped to your user
                  account.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title" className="font-semibold text-sm">
                    Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="Enter document title"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value, false)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="slug" className="font-semibold text-sm">
                    URL Slug
                  </Label>
                  <Input
                    id="slug"
                    placeholder="document-url-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="content" className="font-semibold text-sm">
                    Initial Content (HTML)
                  </Label>
                  <textarea
                    id="content"
                    placeholder="<p>Write something here...</p>"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-6 mt-2 border border-border/60 bg-muted/20 p-3 rounded-lg">
                  <span className="text-sm font-semibold text-foreground">Document Status:</span>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      checked={status === true}
                      onChange={() => setStatus(true)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      checked={status === false}
                      onChange={() => setStatus(false)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Draft</span>
                  </label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2 cursor-pointer"
                >
                  {submitting && <IconLoader2 className="animate-spin w-4 h-4" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Document Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg bg-card border border-border">
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Edit Document</DialogTitle>
                <DialogDescription>Modify document details and state settings.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-title" className="font-semibold text-sm">
                    Title
                  </Label>
                  <Input
                    id="edit-title"
                    placeholder="Enter document title"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value, true)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-slug" className="font-semibold text-sm">
                    URL Slug
                  </Label>
                  <Input
                    id="edit-slug"
                    placeholder="document-url-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-content" className="font-semibold text-sm">
                    Content (HTML)
                  </Label>
                  <textarea
                    id="edit-content"
                    placeholder="<p>Write something here...</p>"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-6 mt-2 border border-border/60 bg-muted/20 p-3 rounded-lg">
                  <span className="text-sm font-semibold text-foreground">Document Status:</span>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      checked={status === true}
                      onChange={() => setStatus(true)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      checked={status === false}
                      onChange={() => setStatus(false)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Draft</span>
                  </label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={submitting}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2 cursor-pointer"
                >
                  {submitting && <IconLoader2 className="animate-spin w-4 h-4" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="max-w-md bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-red-500">
                <IconAlertTriangle />
                Delete Document
              </DialogTitle>
              <DialogDescription>
                Are you absolutely sure you want to delete this document? This action is permanent
                and will remove all comments, rooms, and chat records linked to it.
              </DialogDescription>
            </DialogHeader>

            {selectedDoc && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 my-2">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                  Document to delete
                </span>
                <h4 className="font-semibold text-foreground text-sm truncate mt-0.5">
                  {selectedDoc.title}
                </h4>
                <p className="text-muted-foreground text-xs mt-0.5">/{selectedDoc.slug}</p>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                disabled={submitting}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center gap-2 cursor-pointer"
              >
                {submitting && <IconLoader2 className="animate-spin w-4 h-4" />}
                Permanently Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
