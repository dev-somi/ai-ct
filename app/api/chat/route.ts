import { streamChat } from "@/lib/llm";
import { CHAT_SYSTEM } from "@/lib/prompts";
import { getSettings } from "@/lib/store";
import type { ChatMsg, ModelChoice } from "@/lib/types";

/** body: { messages, choice? } → text/plain 스트림 */
export async function POST(req: Request) {
  const { messages, choice } = (await req.json()) as { messages: ChatMsg[]; choice?: ModelChoice };
  const settings = await getSettings();
  const use = choice ?? settings.chat;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const t of streamChat(settings, use, {
          system: CHAT_SYSTEM,
          messages,
          signal: req.signal,
        }))
          controller.enqueue(encoder.encode(t));
      } catch (e) {
        if (!req.signal.aborted)
          controller.enqueue(encoder.encode(`\n\n⚠️ ${e instanceof Error ? e.message : String(e)}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
