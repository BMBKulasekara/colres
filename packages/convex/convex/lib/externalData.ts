/**
 * Helpers for taking data from third-party APIs into Convex.
 *
 * The recurring hazard these exist for: `v.optional(x)` means "absent or
 * `undefined`", and rejects `null`. Most scholarly APIs — OpenAlex and Crossref
 * among them — signal a missing value with an explicit JSON `null` instead of
 * leaving the key out. Because those responses are cast rather than parsed, a
 * null travels all the way to the mutation boundary before anything notices,
 * where it fails argument validation and takes the whole batch down with it.
 *
 * So every optional string arriving from outside goes through here first.
 */

/**
 * Normalises an external optional string: `null`, `undefined`, and whitespace
 * all collapse to `undefined`.
 *
 * Blank strings are treated as absent deliberately. A field the upstream API
 * returned as `""` carries no more information than a missing one, and storing
 * it would put an empty venue or DOI into a rendered citation.
 */
export function optionalText(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
