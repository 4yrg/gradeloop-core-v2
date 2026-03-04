"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { Loader2 } from "lucide-react";
import type { ProgrammingLanguage } from "@/types/assessment.types";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: ProgrammingLanguage;
  readOnly?: boolean;
  height?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = "600px",
}: CodeEditorProps) {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || "");
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleEditorChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          wordWrap: "on",
          readOnly: readOnly,
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          cursorBlinking: "smooth",
          smoothScrolling: true,
          contextmenu: true,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          glyphMargin: false,
          scrollbar: {
            vertical: "visible",
            horizontal: "visible",
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-zinc-900">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        }
      />
    </div>
  );
}
