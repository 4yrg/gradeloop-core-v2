"use client";

import * as React from "react";
import { Sparkles, Copy, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { streamCloneExplanation } from "@/lib/api/cipas-client";
import type { CollusionEdge } from "@/types/cipas";

interface XAIExplanationProps {
  codeA: string;
  codeB: string;
  edge: CollusionEdge;
  /** Unique key — when it changes, the explanation resets */
  pairKey: string;
}

type State = "idle" | "loading" | "streaming" | "done" | "error";

export function XAIExplanation({ codeA, codeB, edge, pairKey }: XAIExplanationProps) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<State>("idle");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Reset when the active pair changes
  React.useEffect(() => {
    abortRef.current?.abort();
    setState("idle");
    setText("");
    setError(null);
    setOpen(false);
  }, [pairKey]);

  // Auto-scroll while streaming
  React.useEffect(() => {
    if (state === "streaming" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text, state]);

  const handleGenerate = async () => {
    if (state === "loading" || state === "streaming") return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState("loading");
    setError(null);
    setText("");
    setOpen(true);

    try {
      setState("streaming");
      let accumulated = "";
      for await (const chunk of streamCloneExplanation(codeA, codeB, edge)) {
        if (abortRef.current.signal.aborted) break;
        accumulated += chunk;
        setText(accumulated);
      }
      setState("done");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to get explanation");
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRunning = state === "loading" || state === "streaming";

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header row — always visible */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
        <Sparkles className="h-4 w-4 text-purple-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">AI Clone Explanation</p>
          <p className="text-xs text-muted-foreground">
            Powered by CIPAS XAI — explains why these submissions were flagged as{" "}
            <span className="font-mono">{edge.clone_type}</span> with{" "}
            {Math.round(edge.confidence * 100)}% confidence
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {state === "done" && text && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={isRunning}
            className="h-7 px-3 text-xs gap-1.5"
          >
            {isRunning ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : state === "done" ? (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Get AI Explanation
              </>
            )}
          </Button>
          {(text || state === "error") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              className="h-7 w-7 p-0"
            >
              {open ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Explanation body */}
      {open && (
        <div className="border-t">
          {state === "error" && error && (
            <div className="flex items-start gap-2 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {(state === "streaming" || state === "done") && (
            <div
              ref={scrollRef}
              className="max-h-72 overflow-y-auto p-4"
            >
              <ExplanationMarkdown text={text} streaming={state === "streaming"} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── minimal markdown renderer ───────────────────────────────────────────────
// Renders **bold**, bullet points, and numbered sections without a full MD lib.

function ExplanationMarkdown({ text, streaming }: { text: string; streaming: boolean }) {
  const lines = text.split("\n");

  return (
    <div className="text-sm space-y-1 text-foreground/90">
      {lines.map((line, i) => {
        // Numbered section header: "1. **Title** — rest"
        const sectionMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*[—–-]?\s*(.*)/);
        if (sectionMatch) {
          return (
            <div key={i} className="mt-3 first:mt-0">
              <p className="font-semibold text-foreground">
                {sectionMatch[1]}. {sectionMatch[2]}
                {sectionMatch[3] ? <span className="font-normal text-muted-foreground"> — {sectionMatch[3]}</span> : null}
              </p>
            </div>
          );
        }

        // Bullet points
        if (line.match(/^[-*•]\s/)) {
          return (
            <p key={i} className="pl-4 text-muted-foreground">
              • {renderInline(line.replace(/^[-*•]\s/, ""))}
            </p>
          );
        }

        // Blank line
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Regular paragraph
        return (
          <p key={i} className="text-muted-foreground leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
      {streaming && (
        <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse rounded-sm align-middle" />
      )}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-medium">{part.slice(2, -2)}</strong>;
    }
    // Also handle `code` spans
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith("`") && cp.endsWith("`")) {
        return <code key={`${i}-${j}`} className="font-mono text-xs bg-muted px-1 rounded">{cp.slice(1, -1)}</code>;
      }
      return <React.Fragment key={`${i}-${j}`}>{cp}</React.Fragment>;
    });
  });
}
