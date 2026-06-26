"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";

// A small rich-text editor built on contentEditable + execCommand, emitting HTML.
// Seeded once from `initialHTML`; reports changes via onChange (uncontrolled to
// keep the caret stable). Reuses the .announcement-body / .announcement-editor
// styles from globals.css.
export default function RichTextEditor({
  initialHTML = "",
  onChange,
  placeholder = "Write…",
  minHeight = 120,
}: {
  initialHTML?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHTML;
    // Seed once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, value?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    onChange(ref.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("Link URL", "https://");
    if (url) exec("createLink", url);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
        <ToolBtn label="Bold" onClick={() => exec("bold")}>
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn label="Italic" onClick={() => exec("italic")}>
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn label="Underline" onClick={() => exec("underline")}>
          <span className="underline">U</span>
        </ToolBtn>
        <Divider />
        <ToolBtn label="Bulleted list" onClick={() => exec("insertUnorderedList")}>
          <Icon name="list" className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn label="Numbered list" onClick={() => exec("insertOrderedList")}>
          <span className="text-[11px] font-semibold">1.</span>
        </ToolBtn>
        <Divider />
        <ToolBtn label="Add link" onClick={addLink}>
          <span className="text-xs font-semibold underline">Link</span>
        </ToolBtn>
        <ToolBtn label="Clear formatting" onClick={() => exec("removeFormat")}>
          <span className="text-[11px] font-semibold">T×</span>
        </ToolBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        style={{ minHeight }}
        className="announcement-body announcement-editor max-h-72 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-slate-700 outline-none"
      />
    </div>
  );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-7 min-w-[28px] items-center justify-center rounded px-1.5 text-slate-600 transition hover:bg-slate-200"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-slate-200" />;
}
