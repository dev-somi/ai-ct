import "server-only";
import type { ChatMsg, ModelChoice, Provider, Settings } from "../types";
import { MODEL_SUGGESTIONS } from "../models";
export { MODEL_SUGGESTIONS };
import {
  streamAnthropic,
  streamClaudeCli,
  streamGemini,
  streamOpenAI,
  type StreamArgs,
} from "./providers";

export function streamChat(
  settings: Settings,
  choice: ModelChoice,
  args: Omit<StreamArgs, "model">,
): AsyncGenerator<string> {
  const a = { ...args, model: choice.model };
  const need = (k: keyof Settings["keys"]) => {
    const v = settings.keys[k];
    if (!v) throw new Error(`${k} API 키가 설정되지 않았습니다. 설정 화면에서 키를 입력하세요.`);
    return v;
  };
  switch (choice.provider) {
    case "claude-cli":
      return streamClaudeCli(a);
    case "anthropic":
      return streamAnthropic(need("anthropic"), a);
    case "openai":
      return streamOpenAI(need("openai"), a);
    case "gemini":
      return streamGemini(need("gemini"), a);
  }
}

export async function completeText(
  settings: Settings,
  choice: ModelChoice,
  system: string,
  user: string,
  signal?: AbortSignal,
) {
  const messages: ChatMsg[] = [{ role: "user", content: user }];
  let out = "";
  for await (const t of streamChat(settings, choice, { system, messages, signal, maxTokens: 16000 }))
    out += t;
  return out;
}

/** 응답 텍스트에서 첫 JSON 객체를 꺼낸다 (```json 펜스 허용) */
export function extractJson<T>(text: string): T {
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);
  let lastErr: unknown = new Error("응답에서 JSON을 찾지 못했습니다.");
  for (const body of candidates) {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(body.slice(start, end + 1)) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}


/** 공급자의 모델 목록 API를 조회한다 (키 필요) */
export async function listRemoteModels(settings: Settings, provider: Provider): Promise<string[]> {
  if (provider === "claude-cli") return MODEL_SUGGESTIONS["claude-cli"];
  if (provider === "anthropic" && settings.keys.anthropic) {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": settings.keys.anthropic, "anthropic-version": "2023-06-01" },
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    return ((await r.json()).data as { id: string }[]).map((m) => m.id);
  }
  if (provider === "openai" && settings.keys.openai) {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${settings.keys.openai}` },
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    return ((await r.json()).data as { id: string }[])
      .map((m) => m.id)
      .filter((id) => /^(gpt|o\d|chatgpt)/.test(id))
      .sort()
      .reverse();
  }
  if (provider === "gemini" && settings.keys.gemini) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": settings.keys.gemini },
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    return (
      (await r.json()).models as { name: string; supportedGenerationMethods?: string[] }[]
    )
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
  }
  return MODEL_SUGGESTIONS[provider];
}
