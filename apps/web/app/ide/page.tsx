"use client";

import { CodeEditorDialog } from "@/components/ide";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code2 } from "lucide-react";
import Link from "next/link";

export default function PublicIDEPage() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-6 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Code2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">GradeLoop Code Editor</h1>
              <p className="text-sm text-muted-foreground">
                Online IDE with support for 20+ languages
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Show info about the IDE */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <Code2 className="h-10 w-10 text-primary" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Open Code Editor</h2>
            <p className="text-muted-foreground mt-2">
              Start coding in our online IDE with support for 20+ programming
              languages
            </p>
          </div>
          <CodeEditorDialog
            title="GradeLoop Code Editor"
            description="Practice coding with instant feedback"
            showAIAssistant={true}
          />
          <div className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold">Judge0</span> and{" "}
            <span className="font-semibold">Monaco Editor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
