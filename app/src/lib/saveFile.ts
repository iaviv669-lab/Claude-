// Offer a generated file. Inside a claude.ai artifact, plain downloads are blocked, so use the
// viewer's `downloads` capability there; everywhere else, a normal browser download.
type Downloads = { save(r: { filename: string; data: string }): Promise<{ status: string }> };
type ClaudeRuntime = { use(name: string): Promise<unknown> };

export async function saveFile(filename: string, text: string, type: string): Promise<'saved' | 'declined' | 'unavailable'> {
  const rt = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (rt?.use) {
    const d = (await rt.use('downloads').catch(() => null)) as Downloads | null;
    if (d) {
      try { await d.save({ filename, data: text }); return 'saved'; }
      catch (e) { return (e as { code?: string })?.code === 'declined' ? 'declined' : 'unavailable'; }
    }
    return 'unavailable';
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
