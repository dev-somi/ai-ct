export type ProblemType = "solution" | "communication" | "document";

export const PROBLEM_TYPE_LABEL: Record<ProblemType, string> = {
  solution: "비즈니스 솔루션 설계",
  communication: "전략적 커뮤니케이션",
  document: "문서 작성형",
};

export interface Problem {
  id: string;
  type: ProblemType;
  title: string;
  industry?: string;
  scenario: {
    background: string;
    task: string;
    requirements: string[];
  };
  /** Markdown: 표, 데이터, 메일 원문 등 */
  references?: string;
  submitFormat: {
    maxChars: number;
    language: "ko" | "en";
    note?: string;
  };
  timeLimitMin: number;
  rubricHints?: string[];
  source?: "seed" | "generated";
}

export type Provider = "claude-cli" | "anthropic" | "openai" | "gemini";

export const PROVIDER_LABEL: Record<Provider, string> = {
  "claude-cli": "Claude Code CLI",
  anthropic: "Claude API",
  openai: "OpenAI (ChatGPT)",
  gemini: "Google Gemini",
};

export interface ModelChoice {
  provider: Provider;
  model: string;
}

export interface Settings {
  chat: ModelChoice;
  grader: ModelChoice;
  keys: { anthropic?: string; openai?: string; gemini?: string };
  layout: "skax" | "skcc";
}

/** 클라이언트로 내려가는 설정 (키는 마스킹) */
export interface PublicSettings extends Omit<Settings, "keys"> {
  keys: { anthropic?: string; openai?: string; gemini?: string };
  available: Record<Provider, boolean>;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  at?: number;
  model?: string;
}

export interface ChatThread {
  id: string;
  messages: ChatMsg[];
}

export interface PasteEvent {
  chars: number;
  fromChat: boolean;
  at: number;
}

export interface GradeScore {
  key: string;
  label: string;
  score: number;
  max: number;
  comment: string;
}

export interface Grade {
  total: number;
  scores: GradeScore[];
  summary: string;
  strengths: string[];
  improvements: string[];
  betterPrompts: string[];
  modelAnswer: string;
  gradedBy: string;
  gradedAt: number;
}

export interface StageState {
  problem: Problem;
  threads: ChatThread[];
  answerHtml: string;
  answerText: string;
  submitted: boolean;
  submittedAt?: number;
  pastes: PasteEvent[];
  timeSpentSec: number;
  grade?: Grade;
  gradeError?: string;
}

export interface Session {
  id: string;
  mode: "mock" | "practice";
  title: string;
  createdAt: number;
  startedAt: number;
  timeLimitSec: number;
  status: "in_progress" | "submitted" | "graded";
  finishedAt?: number;
  stages: StageState[];
  tabSwitches: number;
}

export interface SessionSummary {
  id: string;
  mode: Session["mode"];
  title: string;
  createdAt: number;
  status: Session["status"];
  totals: (number | null)[];
  types: ProblemType[];
}
