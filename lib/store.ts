import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type {
  Problem,
  PublicSettings,
  Session,
  SessionSummary,
  Settings,
} from "./types";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const GENERATED_DIR = path.join(DATA_DIR, "problems");
const SEED_DIR = path.join(ROOT, "content", "problems");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const DEFAULT_SETTINGS: Settings = {
  chat: { provider: "claude-cli", model: "sonnet" },
  grader: { provider: "claude-cli", model: "sonnet" },
  keys: {},
  layout: "skax",
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function safeId(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error("invalid id");
  return id;
}

/* ---------- settings ---------- */

export async function getSettings(): Promise<Settings> {
  const saved = await readJson<Partial<Settings>>(SETTINGS_FILE);
  const keys = {
    anthropic: saved?.keys?.anthropic || process.env.ANTHROPIC_API_KEY,
    openai: saved?.keys?.openai || process.env.OPENAI_API_KEY,
    gemini:
      saved?.keys?.gemini ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY,
  };
  return { ...DEFAULT_SETTINGS, ...saved, keys };
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = (await readJson<Partial<Settings>>(SETTINGS_FILE)) ?? {};
  const keys = { ...(current.keys ?? {}) };
  // 빈 문자열 → 삭제, 마스킹 값(…포함) → 유지
  for (const k of ["anthropic", "openai", "gemini"] as const) {
    const v = patch.keys?.[k];
    if (v === undefined || v.includes("…")) continue;
    if (v.trim() === "") delete keys[k];
    else keys[k] = v.trim();
  }
  const next = { ...DEFAULT_SETTINGS, ...current, ...patch, keys };
  await writeJson(SETTINGS_FILE, next);
}

function mask(key?: string) {
  if (!key) return undefined;
  return key.length <= 10 ? "…" : `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function toPublic(s: Settings): PublicSettings {
  return {
    ...s,
    keys: {
      anthropic: mask(s.keys.anthropic),
      openai: mask(s.keys.openai),
      gemini: mask(s.keys.gemini),
    },
    available: {
      "claude-cli": true,
      anthropic: !!s.keys.anthropic,
      openai: !!s.keys.openai,
      gemini: !!s.keys.gemini,
    },
  };
}

/* ---------- problems ---------- */

async function readDir<T>(dir: string): Promise<T[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const items = await Promise.all(files.map((f) => readJson<T>(path.join(dir, f))));
  return items.filter((x): x is Awaited<T> => x !== null) as T[];
}

export async function listProblems(): Promise<Problem[]> {
  const seed = (await readDir<Problem>(SEED_DIR)).map((p) => ({ ...p, source: "seed" as const }));
  const gen = (await readDir<Problem>(GENERATED_DIR)).map((p) => ({
    ...p,
    source: "generated" as const,
  }));
  return [...seed, ...gen].sort((a, b) => a.id.localeCompare(b.id));
}

export async function getProblem(id: string) {
  return (await listProblems()).find((p) => p.id === id) ?? null;
}

export async function saveGeneratedProblem(p: Problem) {
  await writeJson(path.join(GENERATED_DIR, `${safeId(p.id)}.json`), p);
}

export async function deleteGeneratedProblem(id: string) {
  await fs.rm(path.join(GENERATED_DIR, `${safeId(id)}.json`), { force: true });
}

/* ---------- sessions ---------- */

export async function getSession(id: string) {
  return readJson<Session>(path.join(SESSIONS_DIR, `${safeId(id)}.json`));
}

export async function saveSession(s: Session) {
  await writeJson(path.join(SESSIONS_DIR, `${safeId(s.id)}.json`), s);
}

export async function deleteSession(id: string) {
  await fs.rm(path.join(SESSIONS_DIR, `${safeId(id)}.json`), { force: true });
}

export async function listSessions(): Promise<SessionSummary[]> {
  const all = await readDir<Session>(SESSIONS_DIR);
  return all
    .map((s) => ({
      id: s.id,
      mode: s.mode,
      title: s.title,
      createdAt: s.createdAt,
      status: s.status,
      totals: s.stages.map((st) => st.grade?.total ?? null),
      types: s.stages.map((st) => st.problem.type),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function newId(prefix = "") {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(
    2,
    "0",
  )}${String(d.getSeconds()).padStart(2, "0")}`;
  return `${prefix}${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}
