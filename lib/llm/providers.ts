import "server-only";
import { spawn } from "child_process";
import os from "os";
import type { ChatMsg } from "../types";
import { ensureOk, readSSE } from "./sse";

export interface StreamArgs {
  model: string;
  system: string;
  messages: ChatMsg[];
  signal?: AbortSignal;
  maxTokens?: number;
}

/* ---------------- Claude Code CLI ---------------- */

/**
 * `claude -p` 를 도구 없이 실행한다. CLI는 호출마다 상태가 없으므로
 * 이전 대화는 system prompt 뒤에 붙이고 마지막 사용자 메시지를 stdin으로 넘긴다.
 */
export async function* streamClaudeCli({ model, system, messages, signal }: StreamArgs) {
  const history = messages.slice(0, -1);
  const last = messages[messages.length - 1];
  let sys = system;
  if (history.length) {
    sys +=
      "\n\n<previous_conversation>\n" +
      history
        .map((m) => `[${m.role === "user" ? "User" : "Assistant"}]\n${m.content}`)
        .join("\n\n") +
      "\n</previous_conversation>\n위 대화에 자연스럽게 이어서 다음 사용자 메시지에 답하세요.";
  }

  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--tools",
    "",
    "--strict-mcp-config",
    "--setting-sources",
    "",
    "--no-session-persistence",
    "--system-prompt",
    sys,
  ];
  if (model) args.push("--model", model);

  const child = spawn(process.env.CLAUDE_BIN || "claude", args, {
    cwd: os.tmpdir(),
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const onAbort = () => child.kill("SIGTERM");
  signal?.addEventListener("abort", onAbort);

  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d.toString()));
  const exited = new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  child.stdin.end(last?.content ?? "");

  let buf = "";
  let emitted = false;
  let resultError: string | null = null;
  try {
    for await (const chunk of child.stdout) {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.type === "stream_event") {
          const e = ev.event as { type: string; delta?: { type: string; text?: string } };
          if (e.type === "content_block_delta" && e.delta?.type === "text_delta" && e.delta.text) {
            emitted = true;
            yield e.delta.text;
          }
        } else if (ev.type === "result") {
          if (ev.is_error) resultError = String(ev.result ?? ev.subtype ?? "unknown error");
          else if (!emitted && typeof ev.result === "string") yield ev.result;
        }
      }
    }
    const code = await exited;
    if (signal?.aborted) return;
    if (resultError) throw new Error(`Claude CLI 오류: ${resultError}`);
    if (code !== 0 && !emitted)
      throw new Error(`Claude CLI 종료 코드 ${code}: ${stderr.slice(0, 500)}`);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}

/* ---------------- Anthropic ---------------- */

export async function* streamAnthropic(key: string, a: StreamArgs) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: a.signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: a.model,
      max_tokens: a.maxTokens ?? 8192,
      system: a.system,
      messages: a.messages.map(({ role, content }) => ({ role, content })),
      stream: true,
    }),
  });
  await ensureOk(res, "Anthropic");
  for await (const data of readSSE(res)) {
    const ev = JSON.parse(data);
    if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") yield ev.delta.text as string;
    else if (ev.type === "error") throw new Error(`Anthropic 오류: ${ev.error?.message}`);
  }
}

/* ---------------- OpenAI ---------------- */

export async function* streamOpenAI(key: string, a: StreamArgs) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: a.signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: a.model,
      stream: true,
      messages: [
        { role: "system", content: a.system },
        ...a.messages.map(({ role, content }) => ({ role, content })),
      ],
    }),
  });
  await ensureOk(res, "OpenAI");
  for await (const data of readSSE(res)) {
    if (data === "[DONE]") break;
    const ev = JSON.parse(data);
    const t = ev.choices?.[0]?.delta?.content;
    if (t) yield t as string;
  }
}

/* ---------------- Gemini ---------------- */

export async function* streamGemini(key: string, a: StreamArgs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    a.model,
  )}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: "POST",
    signal: a.signal,
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: a.system }] },
      contents: a.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    }),
  });
  await ensureOk(res, "Gemini");
  for await (const data of readSSE(res)) {
    const ev = JSON.parse(data);
    const parts = ev.candidates?.[0]?.content?.parts as { text?: string; thought?: boolean }[] | undefined;
    for (const p of parts ?? []) if (p.text && !p.thought) yield p.text;
  }
}
