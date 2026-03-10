"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Code2, GitCompare, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SemanticPairComparison,
  SemanticCluster,
} from "@/components/instructor/similarity/semantic-similarity-section";

interface SemanticDiffSheetProps {
  comparison: SemanticPairComparison | null;
  cluster: SemanticCluster | null;
  open: boolean;
  onClose: () => void;
}

export function SemanticDiffSheet({
  comparison,
  cluster,
  open,
  onClose,
}: SemanticDiffSheetProps) {
  if (!comparison || !cluster) return null;

  const linesA = comparison.submissionA.snippet.split("\n");
  const linesB = comparison.submissionB.snippet.split("\n");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* Fixed header */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-3">
            <GitCompare className="h-5 w-5 text-violet-500" />
            Semantic Diff — {cluster.label}
            <Badge
              variant="secondary"
              className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
            >
              {comparison.semanticScore}% match
            </Badge>
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {cluster.memberCount} submissions in cluster
              </span>
              <Badge variant="outline" className="text-xs capitalize">
                {cluster.category.replace("-", " ")}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">
                {comparison.submissionA.shortId.toUpperCase()} ↔{" "}
                {comparison.submissionB.shortId.toUpperCase()}
              </span>
            </div>
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Cluster context */}
          <Card className="bg-violet-50/50 dark:bg-violet-950/20 border-violet-200/50 dark:border-violet-800/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2">
                <Brain className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Semantic Analysis</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {comparison.explanation}
                  </p>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {comparison.matchedConcepts.map((concept) => (
                      <span
                        key={concept}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 font-medium"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Side-by-side diff with line numbers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-lg border overflow-hidden">
            {/* Submission A */}
            <div className="border-b md:border-b-0 md:border-r">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border-b">
                <Code2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  Submission {comparison.submissionA.shortId.toUpperCase()}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {linesA.length} lines
                </span>
              </div>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-[11px] font-mono">
                  <tbody>
                    {linesA.map((line, i) => (
                      <tr key={i} className="hover:bg-muted/30 group">
                        <td className="py-0 px-2 text-right text-muted-foreground/50 select-none w-8 border-r bg-muted/20 group-hover:text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="py-0 px-3 whitespace-pre">
                          {line || " "}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Submission B */}
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border-b">
                <Code2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Submission {comparison.submissionB.shortId.toUpperCase()}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {linesB.length} lines
                </span>
              </div>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-[11px] font-mono">
                  <tbody>
                    {linesB.map((line, i) => (
                      <tr key={i} className="hover:bg-muted/30 group">
                        <td className="py-0 px-2 text-right text-muted-foreground/50 select-none w-8 border-r bg-muted/20 group-hover:text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="py-0 px-3 whitespace-pre">
                          {line || " "}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Similarity metrics summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Semantic Score"
              value={`${comparison.semanticScore}%`}
              color={comparison.semanticScore >= 90 ? "red" : comparison.semanticScore >= 80 ? "orange" : "amber"}
            />
            <SummaryCard
              label="Cluster Category"
              value={cluster.category.replace("-", " ")}
              color="violet"
            />
            <SummaryCard
              label="Matched Concepts"
              value={String(comparison.matchedConcepts.length)}
              color="blue"
            />
            <SummaryCard
              label="Cluster Members"
              value={String(cluster.memberCount)}
              color="slate"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const bgMap: Record<string, string> = {
    red: "bg-red-50 dark:bg-red-950/20 border-red-200/50 dark:border-red-800/30",
    orange: "bg-orange-50 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30",
    amber: "bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30",
    violet: "bg-violet-50 dark:bg-violet-950/20 border-violet-200/50 dark:border-violet-800/30",
    blue: "bg-blue-50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30",
    slate: "bg-slate-50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-700/30",
  };

  return (
    <div className={cn("rounded-lg border p-3 text-center", bgMap[color] || bgMap.slate)}>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm font-bold capitalize">{value}</p>
    </div>
  );
}
