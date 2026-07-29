'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { useMutation, useQuery } from 'convex/react';
import { Check, Loader } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Tiptap from '../../../components/TipTap';

export default function Editor() {
  const [title, setTitle] = useState('Untitled Document');
  const [content, setContent] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [hasInitialized, setHasInitialized] = useState(false);

  const router = useRouter();
  const params = useParams();
  const editorSlug = params?.editor as string;

  const docs = useQuery(api.documents.getDocument, {
    slug: editorSlug || '',
  });

  const updateDoc = useMutation(api.documents.updateDocument);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    // Initialize
    setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize page title and editor content once from database
  useEffect(() => {
    if (docs && !hasInitialized) {
      setTitle(docs.title);
      setContent(docs.content);
      setHasInitialized(true);
    }
  }, [docs, hasInitialized]);

  // Document saving action
  const handleSave = useCallback(async () => {
    if (!docs || isSaving) return;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await updateDoc({
        id: docs._id,
        title: title,
        content: content,
      });
      setIsDirty(false);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save document:', error);
      setSaveStatus('unsaved');
    } finally {
      setIsSaving(false);
    }
  }, [docs, title, content, isSaving, updateDoc]);

  // Keyboard shortcut Ctrl+S or Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Warning dialog if trying to close/refresh browser page while dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Handle changes from TipTap editor
  const handleEditorChange = (html: string) => {
    setContent(html);
    setIsDirty(true);
    setSaveStatus('unsaved');
  };

  // Loading indicator while waiting for query response
  if (docs === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center gap-4">
          <Loader />
          <span className="text-sm font-semibold text-muted-foreground animate-pulse">
            Loading document...
          </span>
        </div>
      </div>
    );
  }

  // Not found fallback screen
  if (docs === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/10 gap-4">
        <h1 className="text-2xl font-bold text-foreground">Document not found</h1>
        <p className="text-muted-foreground text-sm">
          The document you are looking for does not exist or has been deleted.
        </p>
        <Button onClick={() => router.push('/docs')}>Back to Documents</Button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-muted/10 pb-20 ${isScrolled ? 'mb-24' : 'mb-0'}`}>
      {/* Document Header Wrapper */}
      <div
        className={`sticky top-0 z-30 transition-all duration-300 w-full ${
          isScrolled
            ? 'bg-background/95 backdrop-blur-md border-b border-border/80 shadow-xs'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`flex flex-col justify-center px-1 transition-all duration-300 ${
              isScrolled ? 'h-14 gap-0' : 'h-24 gap-1'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                  setSaveStatus('unsaved');
                }}
                className={`font-extrabold bg-transparent border-none outline-none focus:ring-0 placeholder-muted-foreground w-full p-0 text-foreground tracking-tight transition-all duration-300 ${
                  isScrolled ? 'text-lg' : 'text-3xl'
                }`}
                placeholder="Untitled Document"
              />

              {/* Document status indication and manual save controls */}
              <div className="flex items-center gap-4 ml-4">
                <div className="flex items-center gap-2 text-xs font-semibold select-none">
                  {saveStatus === 'saving' && (
                    <span className="text-muted-foreground flex items-center gap-1.5 animate-pulse">
                      <Loader />
                      Saving...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <Check />
                      Saved
                    </span>
                  )}
                  {saveStatus === 'unsaved' && (
                    <span className="text-amber-500 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping inline-block" />
                      Unsaved changes
                    </span>
                  )}
                </div>

                <Button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  size="sm"
                  variant={isDirty ? 'default' : 'outline'}
                  className="h-8 shadow-xs text-xs font-bold transition-all duration-300"
                >
                  Save
                </Button>
              </div>
            </div>

            <p
              className={`text-muted-foreground font-medium transition-all duration-300 ${
                isScrolled ? 'text-[10px]' : 'text-xs'
              }`}
            >
              Rich text document editor • Draft {docs?.slug}
            </p>
          </div>
        </div>
      </div>

      {/* Document Canvas Wrapper */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-background rounded-xl border border-border/80 shadow-md hover:shadow-lg transition-all duration-300">
          <Tiptap
            isPageScrolled={isScrolled}
            initialContent={docs.content}
            onChange={handleEditorChange}
          />
        </div>
      </div>
    </div>
  );
}
