"use client";
import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import { MODEL_SUGGESTIONS } from "@/lib/models";
import { PROVIDER_LABEL, type ChatMsg, type ModelChoice, type Provider, type PublicSettings } from "@/lib/types";

const MAX_INPUT = 4000;

interface Props {
  messages: ChatMsg[];
  update: (fn: (msgs: ChatMsg[]) => ChatMsg[]) => void;
  onNewChat: () => void;
  settings: PublicSettings | null;
  choice: ModelChoice | null;
  onChoice: (c: ModelChoice) => void;
  disabled?: boolean;
}

export default function ChatPanel({ messages, update, onNewChat, settings, choice, onChoice, disabled }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy || disabled) return;
    const history: ChatMsg[] = [...messages, { role: "user", content: text, at: Date.now() }];
    setInput("");
    stick.current = true;
    update(() => [...history, { role: "assistant", content: "", at: Date.now(), model: choice?.model }]);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), choice }),
        signal: ac.signal,
      });
      if (!res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        update((msgs) => {
          const copy = msgs.slice();
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: last.content + chunk };
          return copy;
        });
      }
    } catch (e) {
      if (!ac.signal.aborted)
        update((msgs) => {
          const copy = msgs.slice();
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: `${last.content}\n\n⚠️ ${String(e)}` };
          return copy;
        });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const providers = (Object.keys(PROVIDER_LABEL) as Provider[]).filter((p) => settings?.available[p]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-[15px] font-bold">AI 채팅</h2>
        {choice && (
          <div className="ml-auto flex items-center gap-1 text-xs">
            <select
              value={choice.provider}
              onChange={(e) => {
                const p = e.target.value as Provider;
                onChoice({ provider: p, model: MODEL_SUGGESTIONS[p][0] });
              }}
              className="h-7 rounded border border-line bg-white px-1"
              title="AI 공급자"
            >
              {providers.map((p) => (
                <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>
              ))}
            </select>
            <input
              list={`models-${choice.provider}`}
              value={choice.model}
              onChange={(e) => onChoice({ ...choice, model: e.target.value })}
              className="h-7 w-36 rounded border border-line px-1.5"
              title="모델"
            />
            <datalist id={`models-${choice.provider}`}>
              {MODEL_SUGGESTIONS[choice.provider].map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
        )}
        <button
          onClick={() => {
            abortRef.current?.abort();
            onNewChat();
          }}
          disabled={disabled}
          className={`${choice ? "" : "ml-auto"} rounded-md border border-line px-2.5 py-1 text-xs hover:bg-panel disabled:opacity-40`}
        >
          ✎ 새 채팅
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="mt-10 text-center text-sm text-muted">
            AI Agent에게 자유롭게 질문하세요.
            <br />
            <span className="text-xs">AI는 문제 내용을 모릅니다. 필요한 맥락은 직접 전달하세요.</span>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-accent px-3.5 py-2 text-sm text-white">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="group relative">
              {m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : (
                <span className="inline-block animate-pulse text-sm text-muted">답변 생성 중…</span>
              )}
              {m.content && !(busy && i === messages.length - 1) && (
                <button
                  onClick={() => navigator.clipboard.writeText(m.content)}
                  className="mt-1 text-xs text-muted opacity-0 hover:text-ink group-hover:opacity-100"
                >
                  복사
                </button>
              )}
            </div>
          ),
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="rounded-xl border border-line focus-within:border-accent">
          <textarea
            value={input}
            disabled={disabled}
            maxLength={MAX_INPUT}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={disabled ? "제출이 완료되었습니다." : "내용을 입력하세요. (Enter 전송, Shift+Enter 줄바꿈)"}
            rows={4}
            className="block w-full resize-none rounded-xl px-3 py-2 text-sm outline-none disabled:bg-panel"
          />
          <div className="flex items-center justify-between px-3 pb-2 text-xs text-muted">
            <span>{input.length.toLocaleString()}/{MAX_INPUT.toLocaleString()}</span>
            {busy ? (
              <button onClick={() => abortRef.current?.abort()} className="rounded-md bg-gray-200 px-3 py-1 text-ink">
                ■ 중지
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim() || disabled}
                className="rounded-md bg-accent px-3 py-1 text-white disabled:opacity-40"
              >
                전송 ➤
              </button>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted">AI의 답변은 부정확할 수 있으니 중요한 정보는 확인하세요.</p>
      </div>
    </div>
  );
}
