// Bound both download and image decoding: a stalled request must never keep
// the page loading forever. Retry once with a fresh request before showing retry UI.
export async function loadModelFile(loader, url, { timeoutMs = 12000, decodeTimeoutMs = timeoutMs, fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    let timer, stage = 'download';
    const deadline = (promise, duration) => Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error(`Model ${stage} timed out`)); }, duration);
    })]).finally(() => clearTimeout(timer));
    try {
      const target = new URL(url, globalThis.location?.href || 'http://localhost/');
      if (attempt) target.searchParams.set('retry', String(attempt));
      const download = (async () => {
        const earlyDownload = !attempt && globalThis.__pirateModelDownloads?.get(target.href);
        globalThis.__pirateModelDownloads?.delete(target.href);
        let bytes;
        if (earlyDownload) bytes = await earlyDownload;
        else {
          const response = await fetchImpl(target.href, { signal: controller.signal, cache: attempt ? 'reload' : 'default' });
          if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
          bytes = await response.arrayBuffer();
        }
        return bytes;
      })();
      const bytes = await deadline(download, timeoutMs);
      if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB response');
      stage = 'decode';
      return await deadline(loader.parseAsync(bytes, new URL('.', target).href), decodeTimeoutMs);
    } catch (error) {
      error.stage = stage;
      lastError = error;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  throw lastError;
}
