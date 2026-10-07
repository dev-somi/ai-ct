"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { api } from "@/lib/client";
import { MODEL_SUGGESTIONS } from "@/lib/models";
import { PROVIDER_LABEL, type ModelChoice, type Provider, type PublicSettings } from "@/lib/types";

const KEY_FIELDS: { k: "anthropic" | "openai" | "gemini"; label: string; hint: string }[] = [
  { k: "anthropic", label: "Claude API (Anthropic)", hint: "sk-ant-…  · console.anthropic.com" },
  { k: "openai", label: "OpenAI (ChatGPT)", hint: "sk-…  · platform.openai.com" },
  { k: "gemini", label: "Google Gemini", hint: "AIza…  · aistudio.google.com" },
];

export default function SettingsPage() {
  const [s, setS] = useState<PublicSettings | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<PublicSettings>("/api/settings").then(setS);
  }, []);

  if (!s) return <div className="p-10 text-sm text-muted">불러오는 중…</div>;

  const saveAll = async (patch: Partial<PublicSettings> & { keys?: Record<string, string> }) => {
    const next = await api<PublicSettings>("/api/settings", { method: "PUT", json: patch });
    setS(next);
    setMsg("저장되었습니다.");
    setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div className="min-h-screen bg-panel">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <h1 className="text-xl font-bold">설정</h1>

        <Card title="AI 모델 선택" desc="기본은 설치된 Claude Code CLI(구독)를 사용합니다. API 키를 등록하면 다른 공급자도 쓸 수 있습니다.">
          <ChoiceEditor
            label="AI 채팅 (시험 중 AI Agent)"
            value={s.chat}
            available={s.available}
            onSave={(c) => saveAll({ chat: c })}
          />
          <ChoiceEditor
            label="채점 · 문제 생성"
            value={s.grader}
            available={s.available}
            onSave={(c) => saveAll({ grader: c })}
          />
          <p className="text-xs text-muted">
            팁: 채점에는 성능이 높은 모델(opus, gpt-5, gemini-2.5-pro 등)을 권장합니다. 시험 화면의 채팅 헤더에서도 모델을 바로 바꿀 수 있습니다.
          </p>
        </Card>

        <Card title="API 키" desc="키는 이 맥북의 data/settings.json에만 저장되며 브라우저에는 마스킹되어 표시됩니다. 환경변수(ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY)도 인식합니다.">
          {KEY_FIELDS.map(({ k, label, hint }) => (
            <div key={k} className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{label}</span>
                {s.keys[k] ? (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">등록됨 {s.keys[k]}</span>
                ) : (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-muted">미등록</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={hint}
                  value={keys[k] ?? ""}
                  onChange={(e) => setKeys({ ...keys, [k]: e.target.value })}
                  className="h-9 flex-1 rounded-md border border-line bg-white px-3 text-sm"
                />
                <button
                  disabled={!keys[k]}
                  onClick={async () => {
                    await saveAll({ keys: { [k]: keys[k] } });
                    setKeys({ ...keys, [k]: "" });
                  }}
                  className="rounded-md bg-ink px-3 text-sm text-white disabled:opacity-40"
                >
                  저장
                </button>
                {s.keys[k] && (
                  <button
                    onClick={() => confirm("키를 삭제할까요?") && saveAll({ keys: { [k]: "" } })}
                    className="rounded-md border border-line px-3 text-sm"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>

        <Card title="시험 화면 배치" desc="실제 시험 UI 두 가지 버전 중 선택합니다.">
          <div className="flex gap-3">
            {(
              [
                ["skax", "에디터 가운데 · 채팅 오른쪽", "SK AX 2026 버전"],
                ["skcc", "채팅 가운데 · 에디터 오른쪽", "SK C&C AICT 버전"],
              ] as const
            ).map(([v, t, d]) => (
              <button
                key={v}
                onClick={() => saveAll({ layout: v })}
                className={`flex-1 rounded-lg border p-3 text-left text-sm ${s.layout === v ? "border-accent bg-blue-50" : "border-line bg-white"}`}
              >
                <p className="font-semibold">{t}</p>
                <p className="text-xs text-muted">{d}</p>
              </button>
            ))}
          </div>
        </Card>

        {msg && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white">{msg}</div>}
      </main>
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-6">
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function ChoiceEditor({
  label,
  value,
  available,
  onSave,
}: {
  label: string;
  value: ModelChoice;
  available: Record<Provider, boolean>;
  onSave: (c: ModelChoice) => Promise<void>;
}) {
  const [c, setC] = useState(value);
  const [models, setModels] = useState<string[]>(MODEL_SUGGESTIONS[value.provider]);
  const [test, setTest] = useState("");
  const listId = `ml-${label}`;

  const loadModels = async (p: Provider) => {
    const r = await api<{ models: string[]; error?: string }>(`/api/models?provider=${p}`);
    setModels(r.models);
    if (r.error) setTest(`모델 목록 조회 실패: ${r.error}`);
  };

  const runTest = async () => {
    setTest("테스트 중…");
    const t0 = Date.now();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ choice: c, messages: [{ role: "user", content: "연결 테스트입니다. '정상'이라고만 답하세요." }] }),
    });
    const text = await res.text();
    setTest(`${((Date.now() - t0) / 1000).toFixed(1)}초 · ${text.trim().slice(0, 300)}`);
  };

  const dirty = c.provider !== value.provider || c.model !== value.model;

  return (
    <div className="space-y-2 rounded-lg bg-panel p-4">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        <select
          value={c.provider}
          onChange={(e) => {
            const p = e.target.value as Provider;
            setC({ provider: p, model: MODEL_SUGGESTIONS[p][0] });
            setModels(MODEL_SUGGESTIONS[p]);
          }}
          className="h-9 rounded-md border border-line bg-white px-2 text-sm"
        >
          {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
            <option key={p} value={p} disabled={!available[p]}>
              {PROVIDER_LABEL[p]}
              {!available[p] ? " (키 필요)" : ""}
            </option>
          ))}
        </select>
        <input
          list={listId}
          value={c.model}
          onChange={(e) => setC({ ...c, model: e.target.value })}
          className="h-9 w-56 rounded-md border border-line bg-white px-2 text-sm"
          placeholder="모델명"
        />
        <datalist id={listId}>
          {models.map((m) => <option key={m} value={m} />)}
        </datalist>
        {c.provider !== "claude-cli" && (
          <button onClick={() => loadModels(c.provider)} className="h-9 rounded-md border border-line bg-white px-3 text-xs">
            모델 목록 불러오기
          </button>
        )}
        <button onClick={runTest} className="h-9 rounded-md border border-line bg-white px-3 text-xs">
          연결 테스트
        </button>
        <button
          disabled={!dirty}
          onClick={() => onSave(c)}
          className="h-9 rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
      {test && <p className="text-xs whitespace-pre-wrap text-muted">{test}</p>}
    </div>
  );
}
