'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { useAction, useMutation, useQuery } from 'convex/react';
import {
  Award,
  Bookmark,
  BookOpen,
  Check,
  Edit2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface ResearchPanelProps {
  documentId: any; // Id<"documents">
}

export function ResearchPanel({ documentId }: ResearchPanelProps) {
  const document = useQuery(api.documents.getDocumentById, { id: documentId });
  const suggestions = useQuery(api.research.getSuggestions, { documentId });
  const updateDocument = useMutation(api.documents.updateDocument);
  const setPaperStatus = useMutation(api.research.setPaperStatus);
  const suggestPapers = useAction(api.research.suggestPapers);

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  if (document === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (document === null) {
    return (
      <div className="p-4 text-center text-xs text-destructive">Document could not be loaded.</div>
    );
  }

  const handleStartEditing = () => {
    setDescriptionInput(document.description || '');
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    setIsSavingDescription(true);
    try {
      await updateDocument({
        id: documentId,
        description: descriptionInput,
      });
      setIsEditingDescription(false);
    } catch (err) {
      console.error('Failed to update description:', err);
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleSuggestPapers = async () => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await suggestPapers({ documentId });
      if (!result.ok) {
        setSearchError(result.error);
      }
    } catch (err) {
      console.error('Failed to suggest papers:', err);
      setSearchError('Something went wrong fetching papers. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const papers = suggestions?.papers ?? [];
  const savedPapers = papers.filter((p) => p.status === 'saved');
  const suggestedPapers = papers.filter((p) => p.status === 'suggested');
  const hasResults = papers.length > 0;

  const renderPaper = (paper: (typeof papers)[number]) => {
    const isExpanded = expandedPaperId === paper.id;
    const isSaved = paper.status === 'saved';
    const readUrl = paper.openAccessUrl || paper.url;

    return (
      <div
        key={paper.id}
        className="bg-background border border-border hover:border-primary/40 rounded-xl p-3.5 transition-all duration-200 shadow-2xs hover:shadow-xs flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2">
            {paper.title}
          </h4>
          <a
            href={readUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors mt-0.5 shrink-0"
            title={paper.openAccessUrl ? 'Open full text (free)' : 'Open paper'}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Why this paper is relevant to this document */}
        {paper.reason && (
          <div className="flex gap-1.5 items-start bg-primary/5 border border-primary/15 rounded-lg px-2.5 py-2">
            <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-foreground/80 leading-relaxed">{paper.reason}</p>
          </div>
        )}

        {/* Meta data */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-muted-foreground">
          <span className="truncate max-w-[150px]">
            {paper.authors.length > 0
              ? paper.authors.slice(0, 2).join(', ') + (paper.authors.length > 2 ? ' et al.' : '')
              : 'Unknown Authors'}
          </span>
          <span className="w-1 h-1 bg-border rounded-full" />
          <span>{paper.year || 'N/A'}</span>
          {paper.citationCount > 0 && (
            <>
              <span className="w-1 h-1 bg-border rounded-full" />
              <span className="flex items-center gap-0.5 text-primary">
                <Award className="h-3 w-3" />
                {paper.citationCount}
              </span>
            </>
          )}
          {paper.openAccessUrl && (
            <>
              <span className="w-1 h-1 bg-border rounded-full" />
              <span className="text-emerald-600 dark:text-emerald-500">Open access</span>
            </>
          )}
        </div>

        {paper.venue && (
          <p className="text-[10px] text-muted-foreground/70 italic truncate">{paper.venue}</p>
        )}

        {/* Abstract preview / expander */}
        {paper.abstract && (
          <div className="space-y-1">
            <p
              className={`text-[11px] text-muted-foreground leading-relaxed ${
                isExpanded ? '' : 'line-clamp-2'
              }`}
            >
              {paper.abstract}
            </p>
            <button
              type="button"
              onClick={() => setExpandedPaperId(isExpanded ? null : paper.id)}
              className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="h-2.5 w-2.5" />
              {isExpanded ? 'Hide Abstract' : 'Read Abstract'}
            </button>
          </div>
        )}

        {/* Save / dismiss */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              setPaperStatus({
                documentId,
                paperId: paper.id,
                status: isSaved ? 'suggested' : 'saved',
              })
            }
            className={`flex items-center gap-1 text-[10px] font-bold ${
              isSaved ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bookmark className={`h-3 w-3 ${isSaved ? 'fill-current' : ''}`} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>
          {!isSaved && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setPaperStatus({ documentId, paperId: paper.id, status: 'dismissed' })}
              className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
              Dismiss
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Document Description Section */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Research Context
          </h3>
          {!isEditingDescription && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleStartEditing}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Edit Description"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {isEditingDescription ? (
          <div className="space-y-2">
            <Textarea
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Describe your research topic or core questions in detail..."
              className="text-xs min-h-[100px] leading-relaxed bg-background"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setIsEditingDescription(false)}
                disabled={isSavingDescription}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                onClick={handleSaveDescription}
                disabled={isSavingDescription}
                className="flex items-center gap-1"
              >
                {isSavingDescription ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            {document.description ? (
              document.description
            ) : (
              <span className="text-muted-foreground/60 block">
                No description provided. Click the edit icon to add context so AI can find highly
                relevant papers.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Suggest action trigger */}
      <div className="flex justify-center">
        <Button
          onClick={handleSuggestPapers}
          disabled={isSearching || (!document.description && !document.title)}
          className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 shadow-xs hover:shadow-md transition-all duration-300"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching Papers...
            </>
          ) : (
            <>
              {hasResults ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {hasResults ? 'Refresh Suggestions' : 'Suggest Research Papers'}
            </>
          )}
        </Button>
      </div>

      {/* Description changed since last generation */}
      {suggestions?.isStale && !isSearching && (
        <div className="text-[11px] text-center px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 rounded-xl">
          Your description changed. Refresh to update these suggestions.
        </div>
      )}

      {searchError && (
        <div className="text-center p-4 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl">
          {searchError}
        </div>
      )}

      {/* Saved papers */}
      {savedPapers.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Saved ({savedPapers.length})
          </div>
          <div className="space-y-3">{savedPapers.map(renderPaper)}</div>
        </div>
      )}

      {/* Suggested papers */}
      {suggestedPapers.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Suggested ({suggestedPapers.length})
          </div>
          <div className="space-y-3">{suggestedPapers.map(renderPaper)}</div>
        </div>
      )}
    </div>
  );
}
