import type { TemplateForm } from './types';

/** Field errors keyed by path: "name", "sections.<rowId>.key", "license.url". */
export type FormErrors = Record<string, string>;

const PLACEHOLDER = /^\{\{[A-Z][A-Z0-9_]*\}\}$/;
const KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;

function duplicates(values: string[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return dupes;
}

export function validateTemplate(form: TemplateForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) errors.name = 'A name is required';
  if (!form.slug.trim()) errors.slug = 'A slug is required';
  if (!Number.isFinite(form.order)) errors.order = 'Enter a number';

  const sectionKeyDupes = duplicates(form.sections.map((s) => s.key.trim()));
  for (const section of form.sections) {
    const at = `sections.${section._rowId}`;
    if (!section.title.trim()) errors[`${at}.title`] = 'Title is required';
    if (!section.key.trim()) errors[`${at}.key`] = 'Key is required';
    else if (!KEY.test(section.key)) errors[`${at}.key`] = 'Letters, numbers, - and _ only';
    else if (sectionKeyDupes.has(section.key.trim())) errors[`${at}.key`] = 'Keys must be unique';
    if (section.targetWords !== undefined && section.targetWords < 0)
      errors[`${at}.targetWords`] = 'Must be 0 or more';
    if (
      section.targetWords !== undefined &&
      section.maxWords !== undefined &&
      section.maxWords < section.targetWords
    ) {
      errors[`${at}.maxWords`] = 'Must be at least the target';
    }
  }

  const fieldKeyDupes = duplicates(form.fields.map((f) => f.key.trim()));
  const placeholderDupes = duplicates(form.fields.map((f) => f.placeholder.trim()));
  for (const field of form.fields) {
    const at = `fields.${field._rowId}`;
    if (!field.label.trim()) errors[`${at}.label`] = 'Label is required';
    if (!field.key.trim()) errors[`${at}.key`] = 'Key is required';
    else if (fieldKeyDupes.has(field.key.trim())) errors[`${at}.key`] = 'Keys must be unique';
    if (!PLACEHOLDER.test(field.placeholder.trim()))
      errors[`${at}.placeholder`] = 'Use the form {{NAME}}';
    else if (placeholderDupes.has(field.placeholder.trim()))
      errors[`${at}.placeholder`] = 'Placeholders must be unique';
  }

  if (!form.documentClass.trim()) errors.documentClass = 'A document class is required';
  if (!form.entryFile.trim()) errors.entryFile = 'An entry file is required';
  if (!Number.isInteger(form.passes) || form.passes < 1 || form.passes > 6)
    errors.passes = 'Between 1 and 6';
  for (const option of form.classOptions) {
    if (!option.value.trim()) errors[`classOptions.${option._rowId}.value`] = 'Value is required';
  }

  if (!form.license.spdx.trim()) errors['license.spdx'] = 'An SPDX identifier is required';
  if (!/^https?:\/\//.test(form.license.url.trim())) errors['license.url'] = 'Enter a full URL';

  return errors;
}

/** Wizard placeholders that don't appear in the content. Advisory, not blocking. */
export function unusedPlaceholders(form: TemplateForm): Set<string> {
  return new Set(
    form.fields
      .filter((f) => f.placeholder && !form.content.includes(f.placeholder))
      .map((f) => f._rowId)
  );
}
