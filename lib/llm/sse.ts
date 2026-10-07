/** fetch Response(body: SSE) → "data:" payload 문자열을 순서대로 내보낸다 */
export async function* readSSE(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx).replace(/^\r?\n\r?\n/, "");
      const data = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) yield data;
    }
  }
}

export async function ensureOk(res: Response, provider: string) {
  if (res.ok) return;
  let detail = "";
  try {
    detail = await res.text();
  } catch {}
  throw new Error(`${provider} API 오류 (${res.status}): ${detail.slice(0, 500)}`);
}
