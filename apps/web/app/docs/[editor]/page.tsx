'use client';

import { useThreads } from '@liveblocks/react/suspense';
import { Thread } from '@liveblocks/react-ui';
import { api } from '@repo/convex/_generated/api';
import type { Doc, Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/components/ui/drawer';
import { useMutation, useQuery } from 'convex/react';
import { FileQuestion, Loader2, MessageSquare } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chat } from '../../../components/Chat';
import { ContributionsPanel } from '../../../components/ContributionsPanel';
import { ChatToasts } from '../../../components/chat/ChatToast';
import { unreadLabel } from '../../../components/chat/UnreadBadge';
import { useChatNotifications } from '../../../components/chat/useChatNotifications';
import { EditorHeader } from '../../../components/editor/EditorHeader';
import {
  PANELS,
  type PanelBadge,
  type PanelId,
  PanelRail,
  SidePanelFrame,
} from '../../../components/editor/SidePanel';
import { useAutosave } from '../../../components/editor/useAutosave';
import { useMediaQuery } from '../../../components/editor/useMediaQuery';
import { ReferencesPanel } from '../../../components/ReferencesPanel';
import { ResearchPanel } from '../../../components/ResearchPanel';
import Tiptap from '../../../components/TipTap';
import { CreateDocumentWizard } from '../../../components/templates/CreateDocumentWizard';
import { getCitationOrder } from '../../../components/tiptap/CitationNumbering';
import { printDocument } from '../../../components/tiptap/printDocument';
import type { CitationStyle } from '../../../lib/citationFormat';
import { type DocumentStatus, documentStatus, statusValue } from '../../../lib/documentStatus';
import { getPageGeometry } from '../../../lib/pageGeometry';
import { Room } from './Room';

/** Which side panel was open last, so ⌘/ and a reload bring it back. */
const PANEL_STORAGE_KEY = 'colres:editor:panel';

export default function Editor() {
  const params = useParams();
  const editorSlug = params?.editor as string;
  const router = useRouter();

  const docs = useQuery(api.documents.getDocument, {
    slug: editorSlug || '',
  });

  if (docs === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <output className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading document…
        </output>
      </div>
    );
  }

  if (docs === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-foreground">Document not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted, or you may not have access to it.
        </p>
        <Button onClick={() => router.push('/docs')}>Back to documents</Button>
      </div>
    );
  }

  return (
    <Room roomId={docs._id}>
      <EditorContent docs={docs} />
    </Room>
  );
}

function CommentsList() {
  const { threads } = useThreads({ query: { resolved: false } });

  return (
    <div className="space-y-4">
      {threads.length > 0 ? (
        threads.map((thread) => <Thread key={thread.id} thread={thread} />)
      ) : (
        <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <MessageSquare className="size-5" aria-hidden="true" />
          No open comments. Select text in the document and choose Comment to start a thread.
        </div>
      )}
    </div>
  );
}

function EditorContent({ docs }: { docs: Doc<'documents'> }) {
  const router = useRouter();
  const [title, setTitle] = useState(docs.title);
  const [editorInstance, setEditorInstance] = useState<any>(null);

  /** The latest HTML this browser has seen, for "Download copy". */
  const latestHtmlRef = useRef(docs.content);

  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const lastPanelRef = useRef<PanelId>('references');

  // Wide enough to dock the panel beside the page; narrower screens get the
  // same panel as a sheet over it.
  const canDockPanel = useMediaQuery('(min-width: 1024px)');
  const isMobile = !useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PANEL_STORAGE_KEY);
      if (stored && PANELS.some((panel) => panel.id === stored)) {
        lastPanelRef.current = stored as PanelId;
        // Reopened on wide screens only; on a phone it would cover the page.
        if (window.matchMedia('(min-width: 1024px)').matches) {
          setActivePanel(stored as PanelId);
        }
      }
    } catch {
      // No stored panel; start with none open.
    }
  }, []);

  const selectPanel = useCallback((panel: PanelId | null) => {
    setActivePanel(panel);
    if (panel) lastPanelRef.current = panel;
    try {
      if (panel) window.localStorage.setItem(PANEL_STORAGE_KEY, panel);
      else window.localStorage.removeItem(PANEL_STORAGE_KEY);
    } catch {
      // Not remembering it is fine.
    }
  }, []);

  /**
   * The unread badge and the new-message notifications.
   *
   * Driven from here rather than from inside the chat, because the whole point
   * of both is the time when the chat is not on screen.
   */
  const { unreadCount, mentionsMe, toasts, dismissToast } = useChatNotifications(
    docs._id,
    activePanel === 'chat'
  );

  const openChat = useCallback(() => selectPanel('chat'), [selectPanel]);

  const { threads } = useThreads({ query: { resolved: false } });

  /**
   * Stores a figure's image and hands back a URL to serve it from.
   *
   * The same path the chat uses: the browser POSTs straight to Convex storage,
   * so the bytes never travel as a mutation argument. `generateUploadUrl`
   * checks document access at the point the URL is issued, which is the only
   * place it can be — the upload itself carries no document reference.
   */
  const generateUploadUrl = useMutation(api.chats.generateUploadUrl);
  const resolveUpload = useMutation(api.documents.resolveUploadUrl);

  const uploadFigureImage = useCallback(
    async (file: File): Promise<string> => {
      const uploadUrl = await generateUploadUrl({ documentId: docs._id });
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: file.type ? { 'Content-Type': file.type } : undefined,
        body: file,
      });

      if (!response.ok) {
        throw new Error(`${file.name} could not be uploaded.`);
      }

      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };

      // The storage id is not itself fetchable; a served URL has to be asked
      // for, and only the server can mint one.
      const url = await resolveUpload({ documentId: docs._id, storageId });
      if (!url) {
        throw new Error('The uploaded image could not be resolved to a URL.');
      }
      return url;
    },
    [generateUploadUrl, resolveUpload, docs._id]
  );

  const updateDoc = useMutation(api.documents.updateDocument);
  const setDocumentCitationStyle = useMutation(api.documents.setCitationStyle);

  const {
    state: saveState,
    lastSavedAt,
    schedule: scheduleSave,
    flush: flushSave,
  } = useAutosave((patch) => updateDoc({ id: docs._id, ...patch }));

  /**
   * The style the document's citations and reference list are set in: the one
   * chosen in the References panel, else the one its template came with.
   */
  const citationStyle: CitationStyle =
    docs.citationStyle ?? docs.templateSnapshot?.citationStyle ?? 'numeric';

  // The bibliography is read here rather than only inside the references
  // panel, because the editor needs it too: a citation can only be numbered
  // once its key is known to be in the bibliography.
  const references = useQuery(api.references.listReferences, { documentId: docs._id });

  // The template's sections, for the outline's word budgets. The snapshot on
  // the document keeps the compilation contract only, so they are read from
  // the template itself.
  const template = useQuery(
    api.templates.getTemplateById,
    docs.templateId ? { id: docs.templateId } : 'skip'
  );

  const geometry = useMemo(
    () =>
      getPageGeometry(docs.templateSnapshot?.classOptions, docs.templateSnapshot?.documentClass),
    [docs.templateSnapshot?.classOptions, docs.templateSnapshot?.documentClass]
  );

  /**
   * Citation keys in the order the document first cites them, reported by the
   * editor. This is what IEEE numbers the reference list by, so the panel and
   * the printed paper both take their order from the text.
   */
  const [citationOrder, setCitationOrder] = useState<string[]>([]);

  /**
   * Whether the document already has a References section, read off the
   * content the editor reports rather than by reaching into ProseMirror: the
   * section serialises to `<div data-bibliography>`.
   */
  const [hasReferencesSection, setHasReferencesSection] = useState(
    (docs.content ?? '').includes('data-bibliography')
  );

  const handleEditorChange = useCallback(
    (html: string, { isLocal }: { isLocal: boolean }) => {
      latestHtmlRef.current = html;
      setHasReferencesSection(html.includes('data-bibliography'));
      // A collaborator's change is saved by the collaborator's own browser.
      if (isLocal) scheduleSave({ content: html });
    },
    [scheduleSave]
  );

  const handleTitleChange = (next: string) => {
    setTitle(next);
    scheduleSave({ title: next });
  };

  const status = documentStatus(docs.status);
  const handleStatusChange = (next: DocumentStatus) => {
    void updateDoc({ id: docs._id, status: statusValue(next) });
  };

  const handlePrint = useCallback(() => {
    if (!editorInstance) return;
    printDocument({
      title: title.trim() || 'Untitled Document',
      contentHtml: editorInstance.getHTML(),
      geometry,
      citationStyle,
      references: references ?? [],
      // The printed reference list is numbered by first appearance, so it
      // needs the same order the markers in the text were numbered from.
      citationOrder: getCitationOrder(editorInstance),
    });
  }, [editorInstance, title, geometry, citationStyle, references]);

  /** A local copy of the text, offered when saving fails. */
  const downloadCopy = useCallback(() => {
    const html = editorInstance?.getHTML() ?? latestHtmlRef.current ?? '';
    const safeTitle = (title.trim() || 'Untitled Document').replace(/[<>&"]/g, '');
    const blob = new Blob(
      [
        `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body>${html}</body></html>`,
      ],
      { type: 'text/html' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docs.slug || 'document'}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }, [editorInstance, title, docs.slug]);

  /** File › New document: the same template-or-blank chooser the home page opens. */
  const [wizardOpen, setWizardOpen] = useState(false);
  const openNewDocument = useCallback(() => {
    // The wizard navigates away once it has created the document.
    void flushSave();
    setWizardOpen(true);
  }, [flushSave]);

  // ⌘S writes now rather than after the debounce; ⌘P prints through the
  // paged print path rather than the browser's view of the app; ⌘/ toggles
  // the side panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        void flushSave();
      } else if (key === 'p') {
        event.preventDefault();
        handlePrint();
      } else if (key === '/') {
        event.preventDefault();
        selectPanel(activePanel ? null : lastPanelRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flushSave, handlePrint, selectPanel, activePanel]);

  // Only warn on leaving while something is genuinely not yet stored.
  useEffect(() => {
    if (saveState === 'saved') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = 'Your latest changes are still being saved.';
      return event.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  const badges: Partial<Record<PanelId, PanelBadge>> = {
    references: {
      count: references?.length ?? 0,
      label: `${references?.length ?? 0} references`,
    },
    comments: {
      count: threads.length,
      label: `${threads.length} open ${threads.length === 1 ? 'thread' : 'threads'}`,
    },
    chat: {
      count: unreadCount,
      highlight: mentionsMe,
      label: unreadLabel(unreadCount, mentionsMe),
    },
  };

  const panelBody = activePanel && (
    <>
      {activePanel === 'research' && <ResearchPanel documentId={docs._id} />}
      {activePanel === 'references' && (
        <ReferencesPanel
          documentId={docs._id}
          citationStyle={citationStyle}
          onCitationStyleChange={(style) =>
            void setDocumentCitationStyle({ id: docs._id, citationStyle: style })
          }
          citationOrder={citationOrder}
          onInsertCitation={
            editorInstance
              ? (key: string) => editorInstance.chain().focus().insertCitation(key).run()
              : undefined
          }
          onInsertBibliography={
            editorInstance
              ? () => editorInstance.chain().focus().insertReferencesSection().run()
              : undefined
          }
          hasBibliography={hasReferencesSection}
        />
      )}
      {activePanel === 'comments' && <CommentsList />}
      {activePanel === 'chat' && <Chat />}
      {activePanel === 'activity' && <ContributionsPanel documentId={docs._id} />}
    </>
  );

  const activeMeta = PANELS.find((panel) => panel.id === activePanel);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <a
        href="#document"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to document
      </a>

      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        templateName={docs.templateSnapshot?.name}
        status={status}
        onStatusChange={handleStatusChange}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        onRetrySave={() => void flushSave()}
        onDownloadCopy={downloadCopy}
        onPrint={handlePrint}
      />

      {saveState === 'offline' && (
        <output className="block shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-center text-sm text-foreground">
          You&rsquo;re offline. Keep writing: your edits are kept in this browser and sync when the
          connection returns.
        </output>
      )}

      <Tiptap
        initialContent={docs.content}
        onChange={handleEditorChange}
        onEditorReady={setEditorInstance}
        classOptions={docs.templateSnapshot?.classOptions}
        documentClass={docs.templateSnapshot?.documentClass}
        templateSections={template?.sections}
        references={references}
        citationStyle={citationStyle}
        onCitationOrderChange={setCitationOrder}
        onUploadImage={uploadFigureImage}
        onOpenReferences={() => selectPanel('references')}
        documentActions={{
          onNewDocument: openNewDocument,
          onOpenDocuments: () => router.push('/docs'),
          onSave: () => void flushSave(),
          onPrint: handlePrint,
          onDownloadHtml: downloadCopy,
          activePanel,
          onSelectPanel: selectPanel,
        }}
        panel={
          canDockPanel && activePanel ? (
            <SidePanelFrame
              panel={activePanel}
              onClose={() => selectPanel(null)}
              className="w-88 shrink-0 border-l border-border xl:w-96"
            >
              {panelBody}
            </SidePanelFrame>
          ) : null
        }
        rail={<PanelRail active={activePanel} onSelect={selectPanel} badges={badges} />}
      />

      {!canDockPanel && (
        <Drawer
          direction={isMobile ? 'bottom' : 'right'}
          open={activePanel !== null}
          onOpenChange={(open) => !open && selectPanel(null)}
        >
          <DrawerContent className="flex h-full max-h-[85dvh] w-full flex-col bg-card p-0 md:max-h-none md:max-w-md">
            <DrawerHeader className="border-b border-border p-4 text-left">
              <DrawerTitle className="text-sm font-semibold">{activeMeta?.title}</DrawerTitle>
              <DrawerDescription className="text-xs">{activeMeta?.description}</DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{panelBody}</div>
          </DrawerContent>
        </Drawer>
      )}

      {wizardOpen && <CreateDocumentWizard open onOpenChange={setWizardOpen} />}

      {/* Bottom-left, so the notifications never sit on top of the docked panel. */}
      <ChatToasts toasts={toasts} onOpen={openChat} onDismiss={dismissToast} />
    </div>
  );
}
