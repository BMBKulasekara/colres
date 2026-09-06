'use client';
import { useAuth, useOrganization, useUser } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@repo/ui/components/ui/alert-dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { useMutation, useQuery } from 'convex/react';
import { Frown, LayoutGrid, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { CreateDocumentWizard } from '../../components/templates/CreateDocumentWizard';

export default function Docs() {
  const { user } = useUser();
  const { isLoaded } = useAuth();
  const { organization } = useOrganization();

  // The Clerk id is no longer sent: Convex reads the caller's identity from
  // the verified token, so it cannot be spoofed by passing someone else's.
  const documents = useQuery(
    api.documents.getAllDocumentsByUserId,
    user?.id ? { orgId: organization?.id } : 'skip'
  );

  const deleteDoc = useMutation(api.documents.deleteDocumentById);

  const handleDelete = async (id: any) => {
    try {
      await deleteDoc({ id });
    } catch (error) {
      console.error('Failed to delete document:', error);
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
                  {organization
                    ? `Viewing documents for ${organization.name}`
                    : 'Access and manage your rich text documents'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="lg" className="font-semibold">
                  <Link href="/docs/templates">
                    <LayoutGrid className="h-4 w-4 mr-1.5" />
                    Browse templates
                  </Link>
                </Button>

                <CreateDocumentWizard
                  trigger={
                    <Button
                      size="lg"
                      className="shadow-xs hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 font-semibold"
                    >
                      Create Document
                    </Button>
                  }
                />
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-2xl w-full max-w-xl bg-card/50 mt-8">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
                  <Frown />
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
                  <div
                    key={doc._id}
                    className="group relative flex flex-col justify-between p-6 bg-card hover:bg-muted/30 rounded-2xl border border-border/80 shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden transform hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <Link
                      href={`/docs/${doc.slug}`}
                      className="absolute inset-0 z-0"
                      aria-label={`Open document ${doc.title}`}
                    />

                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="space-y-3 z-10 pointer-events-none">
                      <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-1">
                        {doc.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {doc.content ? doc.content.replace(/<[^>]*>/g, '') : 'No content yet...'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40 text-[11px] font-medium text-muted-foreground z-10">
                      <span className="pointer-events-none flex items-center gap-1.5 min-w-0">
                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {doc.templateSnapshot && (
                          <span
                            className="truncate text-primary/80 font-semibold"
                            title={`Created from the ${doc.templateSnapshot.name} template`}
                          >
                            · {doc.templateSnapshot.name}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 pointer-events-auto">
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground pointer-events-none">
                          {doc.status ? 'Draft' : 'Published'}
                        </span>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors duration-200"
                              title="Delete document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{doc.title}"? This action cannot be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant={'destructive'}
                                onClick={() => handleDelete(doc._id)}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
