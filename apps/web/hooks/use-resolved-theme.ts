/**
 * Review has no light mode in its own interface — only a share link can still
 * choose one for its external viewers (see hooks/use-share-appearance.ts).
 * Kept as a hook (rather than inlining 'dark' at each call site) so that
 * boundary stays named and searchable.
 */
export function useResolvedTheme(): 'dark' | 'light' {
  return 'dark'
}
