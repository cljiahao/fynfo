/** Returns the same object when the field has no error so React skips the re-render. */
export function omitError<K extends string>(
  errors: Partial<Record<K, string>>,
  field: K
): Partial<Record<K, string>> {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

export function invalidProps(id: string, message: string | undefined) {
  return message
    ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` }
    : {};
}
