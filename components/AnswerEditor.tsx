"use client";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";

interface Props {
  initialHtml: string;
  readOnly: boolean;
  maxChars: number;
  onChange: (html: string, text: string) => void;
  onPasteText?: (text: string) => void;
}

export default function AnswerEditor({ initialHtml, readOnly, maxChars, onChange, onPasteText }: Props) {
  const onPasteRef = useRef(onPasteText);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onPasteRef.current = onPasteText;
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    content: initialHtml || "",
    extensions: [
      StarterKit.configure({ link: false }),
      TextStyleKit,
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "AI Agent를 활용하여 문제를 해결하되, 중요한 정보는 확인하세요." }),
    ],
    editorProps: {
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (text) onPasteRef.current?.(text);
        return false; // 기본 붙여넣기 동작 유지
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML(), plainText(editor)),
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const count = useEditorState({
    editor,
    selector: ({ editor }) => (editor ? plainText(editor).length : 0),
  });

  return (
    <div className={`answer-editor flex h-full min-h-0 flex-col ${readOnly ? "locked" : ""}`}>
      <Toolbar editor={editor} disabled={readOnly} />
      <div className="min-h-0 flex-1 overflow-y-auto" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} className="h-full" />
      </div>
      <div className="flex justify-end border-t border-line px-4 py-1.5 text-xs text-muted">
        <span className={count && count > maxChars ? "font-semibold text-brand" : ""}>
          문자수: {(count ?? 0).toLocaleString()} / {maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/** 문단 사이 줄바꿈을 살린 일반 텍스트 (문자수 계산·채점용) */
export function plainText(editor: Editor) {
  return editor.getText({ blockSeparator: "\n" });
}

function Toolbar({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            table: e.isActive("table"),
            align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
            block: e.isActive("heading", { level: 1 })
              ? "h1"
              : e.isActive("heading", { level: 2 })
                ? "h2"
                : e.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p",
            font: (e.getAttributes("textStyle").fontFamily as string) ?? "",
            size: (e.getAttributes("textStyle").fontSize as string) ?? "",
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });
  if (!editor || !s) return <div className="h-11 border-b border-line bg-panel" />;
  const c = () => editor.chain().focus();
  const off = disabled;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-panel px-2 py-1.5 text-sm">
      <Btn title="실행 취소" disabled={off || !s.canUndo} onClick={() => c().undo().run()}>↶</Btn>
      <Btn title="다시 실행" disabled={off || !s.canRedo} onClick={() => c().redo().run()}>↷</Btn>
      <Sep />
      <select
        title="글꼴"
        disabled={off}
        value={s.font}
        onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}
        className="h-8 rounded border border-line bg-white px-1 text-xs"
      >
        <option value="">기본 글꼴</option>
        <option value="Apple SD Gothic Neo">고딕</option>
        <option value="AppleMyungjo, serif">명조</option>
        <option value="Menlo, monospace">고정폭</option>
      </select>
      <select
        title="글자 크기"
        disabled={off}
        value={s.size}
        onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}
        className="h-8 rounded border border-line bg-white px-1 text-xs"
      >
        <option value="">크기</option>
        {["12px", "14px", "16px", "18px", "22px"].map((v) => (
          <option key={v} value={v}>{v.replace("px", "")}</option>
        ))}
      </select>
      <select
        title="문단 서식"
        disabled={off}
        value={s.block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") c().setParagraph().run();
          else c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
        }}
        className="h-8 rounded border border-line bg-white px-1 text-xs"
      >
        <option value="p">본문</option>
        <option value="h1">제목 1</option>
        <option value="h2">제목 2</option>
        <option value="h3">제목 3</option>
      </select>
      <Sep />
      <Btn title="표 삽입" disabled={off} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon />
      </Btn>
      {s.table && (
        <>
          <Btn title="행 추가" disabled={off} onClick={() => c().addRowAfter().run()} small>+행</Btn>
          <Btn title="열 추가" disabled={off} onClick={() => c().addColumnAfter().run()} small>+열</Btn>
          <Btn title="행 삭제" disabled={off} onClick={() => c().deleteRow().run()} small>-행</Btn>
          <Btn title="열 삭제" disabled={off} onClick={() => c().deleteColumn().run()} small>-열</Btn>
          <Btn title="표 삭제" disabled={off} onClick={() => c().deleteTable().run()} small>표×</Btn>
        </>
      )}
      <Sep />
      <Btn title="굵게 (⌘B)" active={s.bold} disabled={off} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn title="취소선" active={s.strike} disabled={off} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
      <Btn title="밑줄 (⌘U)" active={s.underline} disabled={off} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="기울임 (⌘I)" active={s.italic} disabled={off} onClick={() => c().toggleItalic().run()}><i className="font-serif">I</i></Btn>
      <Sep />
      {(["left", "center", "right", "justify"] as const).map((a) => (
        <Btn key={a} title={`정렬: ${a}`} active={s.align === a} disabled={off} onClick={() => c().setTextAlign(a).run()}>
          <AlignIcon kind={a} />
        </Btn>
      ))}
      <Sep />
      <Btn title="글머리 기호" active={s.bullet} disabled={off} onClick={() => c().toggleBulletList().run()}>•≡</Btn>
      <Btn title="번호 매기기" active={s.ordered} disabled={off} onClick={() => c().toggleOrderedList().run()}>1≡</Btn>
      <Sep />
      <Btn title="서식 지우기" disabled={off} onClick={() => c().unsetAllMarks().clearNodes().run()}>⌫</Btn>
    </div>
  );
}

function Btn(props: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      title={props.title}
      disabled={props.disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`inline-flex h-8 items-center justify-center rounded ${props.small ? "px-1.5 text-xs" : "min-w-8 px-1.5"} ${
        props.active ? "bg-white text-accent shadow-sm ring-1 ring-line" : "text-gray-700 hover:bg-white"
      } disabled:opacity-35`}
    >
      {props.children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-line" />;

function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2.5" width="12" height="11" rx="1" />
      <path d="M2 6.5h12M2 10h12M6 2.5v11M10 2.5v11" />
    </svg>
  );
}

function AlignIcon({ kind }: { kind: "left" | "center" | "right" | "justify" }) {
  const rows: Record<typeof kind, [number, number][]> = {
    left: [[2, 14], [2, 10], [2, 14], [2, 9]],
    center: [[2, 14], [4, 12], [2, 14], [5, 11]],
    right: [[2, 14], [6, 14], [2, 14], [7, 14]],
    justify: [[2, 14], [2, 14], [2, 14], [2, 14]],
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      {rows[kind].map(([x1, x2], i) => (
        <line key={i} x1={x1} x2={x2} y1={3.5 + i * 3} y2={3.5 + i * 3} />
      ))}
    </svg>
  );
}
