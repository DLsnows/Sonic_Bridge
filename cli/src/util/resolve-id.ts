/**
 * Resolve a user-supplied id input (8-char prefix OR full UUID) to a full
 * record by fetching a list of candidates and matching.
 *
 * Resolution order:
 *   1. exact id match  → return that record
 *   2. unique prefix match (record.id.startsWith(input)) → return it
 *   3. zero matches → throw "No <label> matches \"<input>\"."
 *   4. multiple matches → throw "<label> prefix \"<input>\" is ambiguous (matches N).
 *                                Use more characters or full UUID."
 */
export async function resolveByPrefix<T extends { id: string }>(
  input: string,
  fetchAll: () => Promise<T[]>,
  label: string,
): Promise<T> {
  const all = await fetchAll();
  const exact = all.find((x) => x.id === input);
  if (exact) return exact;
  const matches = all.filter((x) => x.id.startsWith(input));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new Error(`No ${label} matches "${input}".`);
  }
  throw new Error(
    `${label} prefix "${input}" is ambiguous (matches ${matches.length}). Use more characters or the full UUID.`,
  );
}
