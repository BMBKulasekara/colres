'use client';

import type { Editor, Range } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import type { LucideIcon } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Slash commands: type "/" in the text to insert anything the Insert menu
 * offers without leaving the keyboard.
 *
 * The items are supplied by the editor component through `resolveItems`,
 * because several of them — a figure's file picker, the citation search —
 * belong to React state the extension cannot see.
 */
export interface SlashCommandItem {
  id: string;
  title: string;
  group: string;
  icon: LucideIcon;
  /** Extra words the item can be found by. */
  keywords?: readonly string[];
  shortcut?: string;
  run: (editor: Editor) => void;
}

export interface SlashCommandsOptions {
  resolveItems: () => readonly SlashCommandItem[];
}

const MAX_ITEMS = 12;

export function filterSlashItems(
  items: readonly SlashCommandItem[],
  query: string
): SlashCommandItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items.slice(0, MAX_ITEMS);
  return items
    .filter((item) =>
      [item.title, item.id, ...(item.keywords ?? [])].some((word) =>
        word.toLowerCase().includes(needle)
      )
    )
    .slice(0, MAX_ITEMS);
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return { resolveItems: () => [] };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommands'),
        char: '/',
        // Not inside code, where a slash is just a slash.
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => filterSlashItems(this.options.resolveItems(), query),
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashCommandItem;
        }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;

          const place = (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
            const rect = props.clientRect?.();
            const element = renderer?.element as HTMLElement | undefined;
            if (!rect || !element) return;
            const height = element.offsetHeight;
            const below = rect.bottom + 6;
            const top =
              below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
            element.style.top = `${top}px`;
            element.style.left = `${Math.min(rect.left, window.innerWidth - element.offsetWidth - 8)}px`;
          };

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });
              const element = renderer.element as HTMLElement;
              element.style.position = 'fixed';
              element.style.zIndex = '60';
              document.body.appendChild(element);
              requestAnimationFrame(() => place(props));
            },
            onUpdate: (props) => {
              renderer?.updateProps({ items: props.items, command: props.command });
              requestAnimationFrame(() => place(props));
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                renderer?.destroy();
                renderer?.element.remove();
                renderer = null;
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              renderer?.destroy();
              renderer?.element.remove();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});

interface SlashMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { items, command },
  ref
) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // A new query is a new list, so the highlight starts again at the top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on a new list
  useEffect(() => setActive(0), [items]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        setActive((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActive((index) => (index - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[active];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-64 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg">
        No matching commands
      </div>
    );
  }

  let lastGroup = '';
  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Insert"
      className="max-h-80 w-64 overflow-y-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg"
    >
      {items.map((item, index) => {
        const showGroup = item.group !== lastGroup;
        lastGroup = item.group;
        return (
          <div key={item.id}>
            {showGroup && (
              <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {item.group}
              </div>
            )}
            <div
              role="option"
              aria-selected={index === active}
              tabIndex={-1}
              data-index={index}
              onPointerMove={() => setActive(index)}
              onPointerDown={(event) => {
                event.preventDefault();
                command(item);
              }}
              className={`mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                index === active ? 'bg-primary-soft text-accent-foreground' : ''
              }`}
            >
              <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 truncate">{item.title}</span>
              {item.shortcut && (
                <kbd className="font-mono text-xs text-muted-foreground">{item.shortcut}</kbd>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
