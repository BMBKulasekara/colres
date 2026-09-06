'use client';

import { useThreads } from '@liveblocks/react/suspense';
import { Thread } from '@liveblocks/react-ui';
import { api } from '@repo/convex/_generated/api';
import { useIsMobile } from '@repo/ui/components/hooks/use-mobile';
import { Button } from '@repo/ui/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/components/ui/drawer';
import { useMutation, useQuery } from 'convex/react';
import { Check, Loader, MessageSquare } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Chat } from '../../../components/Chat';
import { ReferencesPanel } from '../../../components/ReferencesPanel';
import { ResearchPanel } from '../../../components/ResearchPanel';
import Tiptap from '../../../components/TipTap';
import { Collaborators } from './Collaborators';
import { Room } from './Room';

export default function Editor() {
  const params = useParams();
  const editorSlug = params?.editor as string;
  const router = useRouter();

  const docs = useQuery(api.documents.getDocument, {
    slug: editorSlug || '',
  });

  if (docs === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center gap-4">
          <Loader className="animate-spin" />
          <span className="text-sm font-semibold text-muted-foreground animate-pulse">
            Loading document...
          </span>
        </div>
      </div>
    );
  }

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
    <Room roomId={docs._id}>
      <EditorContent docs={docs} />
    </Room>
  );
}

interface EditorContentProps {
  docs: any;
}

function CommentsList() {
  const { threads } = useThreads({ query: { resolved: false } });

  return (
    <div className="space-y-4">
      {threads.length > 0 ? (
        threads.map((thread) => <Thread key={thread.id} thread={thread} />)
      ) : (
        <div className="text-center p-6 text-muted-foreground text-xs">
          No comments yet. Highlight text in the editor to add a comment!
        </div>
      )}
    </div>
  );
}

function EditorContent({ docs }: EditorContentProps) {
  const [title, setTitle] = useState(docs.title);
  const [content, setContent] = useState(docs.content);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [activeTab, setActiveTab] = useState<'comments' | 'chat' | 'research' | 'references'>(
    'comments'
  );
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const isMobile = useIsMobile();

  const updateDoc = useMutation(api.documents.updateDocument);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Document saving action
  const handleSave = useCallback(async () => {
    if (isSaving) return;
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
  }, [docs._id, title, content, isSaving, updateDoc]);

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
                <Collaborators />

                <div className="flex items-center gap-2 text-xs font-semibold select-none">
                  {saveStatus === 'saving' && (
                    <span className="text-muted-foreground flex items-center gap-1.5 animate-pulse">
                      <Loader size={16} className="animate-spin" />
                      Saving...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <Check size={16} />
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

                <Drawer direction={isMobile ? 'bottom' : 'right'}>
                  <DrawerTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground shadow-xs cursor-pointer"
                      title="Collaboration Panel"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="p-0 flex flex-col h-full bg-background border-l border-border max-w-sm sm:max-w-md w-full">
                    <DrawerHeader className="p-4 border-b border-border/85 text-left">
                      <DrawerTitle className="text-sm font-bold text-foreground">
                        Collaboration Panel
                      </DrawerTitle>
                      <DrawerDescription className="text-xs text-muted-foreground">
                        Chat with teammates or view document comments.
                      </DrawerDescription>
                    </DrawerHeader>

                    {/* Tab Navigation */}
                    <div className="flex bg-muted/60 p-1 rounded-lg m-4 border border-border/40 shrink-0">
                      <Button
                        onClick={() => setActiveTab('comments')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          activeTab === 'comments'
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Comments
                      </Button>
                      <Button
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          activeTab === 'chat'
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Team Chat
                      </Button>
                      <Button
                        onClick={() => setActiveTab('research')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          activeTab === 'research'
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Research
                      </Button>
                      <Button
                        onClick={() => setActiveTab('references')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          activeTab === 'references'
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Refs
                      </Button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                      {activeTab === 'comments' && <CommentsList />}
                      {activeTab === 'chat' && <Chat />}
                      {activeTab === 'research' && <ResearchPanel documentId={docs._id} />}
                      {activeTab === 'references' && (
                        <ReferencesPanel
                          documentId={docs._id}
                          citationStyle={docs.templateSnapshot?.citationStyle ?? 'numeric'}
                          onInsertCitation={
                            editorInstance
                              ? (key: string) =>
                                  editorInstance.chain().focus().insertCitation(key).run()
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </div>

            <p
              className={`text-muted-foreground font-medium transition-all duration-300 ${
                isScrolled ? 'text-[10px]' : 'text-xs'
              }`}
            >
              {docs.templateSnapshot?.name ?? 'Rich text document'} • Draft
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
            onEditorReady={setEditorInstance}
          />
        </div>
      </div>
    </div>
  );
}
