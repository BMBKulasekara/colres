'use client';

import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { ChevronDown, Download, Printer } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Collaborators } from '../../app/docs/[editor]/Collaborators';
import { DOCUMENT_STATUS_LABELS, type DocumentStatus } from '../../lib/documentStatus';
import { ColresMark } from '../shell/ColresMark';
import { SaveIndicator } from './SaveIndicator';
import type { SaveState } from './useAutosave';

const STATUS_ORDER: DocumentStatus[] = ['draft', 'active'];

/**
 * The editor's one slim header: the way home, the editable title, the status
 * menu, the autosave state, who is here, export, and the account corner the
 * other pages show in their top bar.
 */
export function EditorHeader({
  title,
  onTitleChange,
  templateName,
  status,
  onStatusChange,
  saveState,
  lastSavedAt,
  onRetrySave,
  onDownloadCopy,
  onPrint,
  readOnly = false,
  share,
}: {
  title: string;
  onTitleChange: (title: string) => void;
  templateName?: string;
  status: DocumentStatus;
  onStatusChange: (status: DocumentStatus) => void;
  saveState: SaveState;
  lastSavedAt: number | null;
  onRetrySave: () => void;
  onDownloadCopy: () => void;
  onPrint: () => void;
  /** Locks the title and status, for people who cannot edit. */
  readOnly?: boolean;
  /** The Share button, placed beside the collaborators. */
  share?: ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
      <Link href="/docs" aria-label="Colres home" className="rounded-md">
        <ColresMark />
      </Link>

      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <Link
          href="/docs"
          className="hidden shrink-0 text-muted-foreground hover:text-foreground sm:inline"
        >
          Home
        </Link>
        <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">
          /
        </span>
        <input
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          readOnly={readOnly}
          aria-label="Document title"
          placeholder="Untitled Document"
          title={templateName ? `${title} · ${templateName}` : title}
          className="min-w-0 max-w-md flex-1 truncate rounded-md bg-transparent px-1.5 py-1 font-semibold text-foreground outline-none hover:bg-muted focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="xs"
              className="shrink-0"
              aria-label="Document status"
              disabled={readOnly}
            >
              {DOCUMENT_STATUS_LABELS[status]}
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={status}
              onValueChange={(value) => onStatusChange(value as DocumentStatus)}
            >
              {STATUS_ORDER.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {DOCUMENT_STATUS_LABELS[option]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="ml-1 hidden shrink-0 md:inline">
          <SaveIndicator
            state={saveState}
            lastSavedAt={lastSavedAt}
            onRetry={onRetrySave}
            onDownloadCopy={onDownloadCopy}
          />
        </span>
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden sm:block">
          <Collaborators />
        </div>

        {share}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download aria-hidden="true" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onPrint}>
              <Printer />
              Print / Save as PDF
              <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDownloadCopy}>
              <Download />
              Download HTML copy
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Switching changes the workspace for the home page and new
            documents; this document stays where it is. */}
        <div className="hidden md:block">
          <OrganizationSwitcher />
        </div>
        <UserButton />
      </div>
    </header>
  );
}
