'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  type FormKey,
  TAB_KEYS,
  type TabId,
  type TemplateForm,
  tabForKey,
  toPayloadValue,
} from './types';
import { type FormErrors, validateTemplate } from './validate';

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Editor state: the working copy, the last saved copy, and what differs.
 * Only changed keys are sent on save, so editing the description no longer
 * bumps the template version the way resending every field did.
 */
export function useTemplateForm(initial: TemplateForm) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);

  const set = useCallback(<K extends FormKey>(key: K, value: TemplateForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const dirtyKeys = useMemo(
    () =>
      (Object.keys(form) as FormKey[]).filter(
        (key) => !same(toPayloadValue(key, form[key]), toPayloadValue(key, saved[key]))
      ),
    [form, saved]
  );

  const errors: FormErrors = useMemo(() => validateTemplate(form), [form]);

  const dirtyTabs = useMemo(() => {
    const tabs = new Set<TabId>();
    for (const key of dirtyKeys) {
      for (const [tab, keys] of Object.entries(TAB_KEYS) as [TabId, FormKey[]][]) {
        if (keys.includes(key)) tabs.add(tab);
      }
    }
    return tabs;
  }, [dirtyKeys]);

  const errorTabs = useMemo(() => new Set(Object.keys(errors).map(tabForKey)), [errors]);

  /** Only the changed keys, in the shape the mutation takes. */
  const patch = useMemo(() => {
    const out: Partial<Record<FormKey, unknown>> = {};
    for (const key of dirtyKeys) out[key] = toPayloadValue(key, form[key]);
    return out;
  }, [dirtyKeys, form]);

  const discard = useCallback(() => setForm(saved), [saved]);
  /** Records what was sent; edits made while the save was in flight stay dirty. */
  const markSaved = useCallback((snapshot: TemplateForm) => setSaved(snapshot), []);

  return {
    form,
    set,
    errors,
    dirty: dirtyKeys.length > 0,
    dirtyKeys,
    dirtyTabs,
    errorTabs,
    patch,
    discard,
    markSaved,
  };
}

export type TemplateFormApi = ReturnType<typeof useTemplateForm>;
