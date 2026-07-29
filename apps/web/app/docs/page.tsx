'use client';
import { useAuth, useUser } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Docs() {
  const { user } = useUser();
  const { isLoaded } = useAuth();
  const [title, setTitle] = useState('Untitled Document');
  const [isCreating, setIsCreating] = useState(false);
  const createDoc = useMutation(api.documents.createDocument);
  const router = useRouter();

  const documents = useQuery(
    api.documents.getAllDocumentsByUserId,
    user?.id ? { clerkId: user.id } : 'skip'
  );

  const firstName = user?.firstName?.toLowerCase().replace(/\s+/g, '-') || 'user';
  const slug = `${firstName}-doc-${title.toLowerCase().replace(/\s+/g, '-')}`;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || isCreating) return;

    setIsCreating(true);
    try {
      await createDoc({
        title,
        slug,
        content: '',
        status: true,
        clerkId: user.id,
      });
      router.push(`/docs/${slug}`);
    } catch (error) {
      console.error('Failed to create document:', error);
      setIsCreating(false);
    }
  };

  const isLoading = !isLoaded || documents === undefined;

  return (
    <div className="min-h-screen w-full bg-background/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col items-center">
        {isLoading ? (
          /* Loading skeleton state */
          <div className="w-full flex flex-col items-center animate-pulse">
            <div className="flex flex-col md:flex-row justify-between items-center w-full mb-12 gap-6 pb-6 border-b border-border/40">
              <div className="space-y-3 w-full md:w-2/3 text-center md:text-left">
                <Skeleton className="h-10 w-48 rounded-xl mx-auto md:mx-0" />
                <Skeleton className="h-6 w-72 rounded-xl mx-auto md:mx-0" />
              </div>
              <Skeleton className="h-11 w-40 rounded-xl" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full mt-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col justify-between p-6 bg-card rounded-2xl border border-border/80 space-y-6"
                >
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-5/6 rounded-md" />
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <Skeleton className="h-4 w-1/3 rounded-md" />
                    <Skeleton className="h-4 w-1/4 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Documents dashboard */
          <div className="w-full flex flex-col items-center">
            <div className="flex flex-col md:flex-row justify-between items-center w-full mb-12 gap-6 pb-6 border-b border-border/40">
              <div className="text-center md:text-left">
                <h1 className="text-4xl font-extrabold text-foreground tracking-tight sm:text-5xl">
                  👋 Hello {user?.firstName}!
                </h1>
                <p className="mt-3 text-lg text-muted-foreground">
                  Access and manage your rich text documents
                </p>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="shadow-xs hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 font-semibold"
                  >
                    Create Document
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreate}>
                    <DialogHeader>
                      <DialogTitle>Create a new document</DialogTitle>
                      <DialogDescription>Enter title of your document.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-6 items-center gap-2">
                        <Label htmlFor="name" className="text-right">
                          Title
                        </Label>
                        <Input
                          id="name"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="col-span-5"
                        />
                      </div>
                      <div className="flex items-center">
                        <p className="text-right text-xs text-gray-400">
                          your document slug will be {slug}
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? 'Creating...' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-2xl w-full max-w-xl bg-card/50 mt-8">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
                  svgicon{' '}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">No documents found</h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-sm">
                  You haven't created any documents yet. Click the button above to start your first
                  rich text document.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full mt-4">
                {documents.map((doc) => (
                  <Link
                    key={doc._id}
                    href={`/docs/${doc.slug}`}
                    className="group relative flex flex-col justify-between p-6 bg-card hover:bg-muted/30 rounded-2xl border border-border/80 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="space-y-3">
                      <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-1">
                        {doc.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {doc.content ? doc.content.replace(/<[^>]*>/g, '') : 'No content yet...'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40 text-[11px] font-medium text-muted-foreground">
                      <span>
                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {doc.status ? 'Draft' : 'Published'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
