// Bound both download and image decoding: a stalled request must never keep
// the page loading forever. Retry once with a fresh request before showing retry UI.
export async function loadModelFile(loader, url, { timeoutMs = 12000, fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    let timer;
    try {
      const target = new URL(url, globalThis.location?.href || 'http://localhost/');
      if (attempt) target.searchParams.set('retry', String(attempt));
      const operation = (async () => {
        const response = await fetchImpl(target.href, { signal: controller.signal, cache: attempt ? 'reload' : 'default' });
        if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB response');
        if (controller.signal.aborted) throw new Error('Model request cancelled');
        return loader.parseAsync(bytes, new URL('.', target).href);
      })();
      return await Promise.race([operation, new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Model loading timed out')); }, timeoutMs);
      })]);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  throw lastError;
}
