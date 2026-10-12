/** Keep repository sources and manual material scoped to the draft at the request boundary. */
export function projectGenerationInput(draft: { repo: { path: string }; sourceRepos?: { path: string }[]; manualWorkContent: string }) {
  return { repoPaths: (draft.sourceRepos ?? [draft.repo]).map((repo) => repo.path), manualWorkContent: draft.manualWorkContent.trim() || undefined };
}

export async function runGenerationQueue<T, R>(items: T[], task: (item: T) => Promise<R>, signal: AbortSignal): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = Array.from({ length: items.length });
  let next = 0;
  async function worker() {
    while (!signal.aborted && next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));
  return results;
}
