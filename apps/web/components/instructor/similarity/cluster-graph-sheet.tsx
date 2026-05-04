"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SimilarityBadge, SimilarityScore } from "./similarity-badge";
import { ForceDirectedGraph } from "./force-directed-graph";
import { GitCompare, Users, Link2 } from "lucide-react";
import type { CollusionGroup, CollusionEdge, StudentDetails } from "@/types/cipas";
import { cn } from "@/lib/utils";

interface ClusterGraphSheetProps {
  cluster: CollusionGroup | null;
  studentDetails?: Record<string, StudentDetails>;
  open: boolean;
  onClose: () => void;
  onCompare: (cluster: CollusionGroup, edge: CollusionEdge) => void;
}

export function ClusterGraphSheet({
  cluster,
  studentDetails = {},
  open,
  onClose,
  onCompare,
}: ClusterGraphSheetProps) {
  if (!cluster) return null;

  const label = String.fromCharCode(64 + cluster.group_id);

  const maxEdge = cluster.edges.length > 0
    ? cluster.edges.reduce((m, e) => (e.confidence > m.confidence ? e : m), cluster.edges[0])
    : null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-6 p-6"
      >
        {/* Header */}
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base shrink-0",
                cluster.max_confidence >= 0.85
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : cluster.max_confidence >= 0.75
                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
              )}
            >
              {label}
            </div>
            Cluster {label}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <SimilarityBadge similarity={cluster.max_confidence} />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {cluster.member_count} students
              </span>
              <span className="text-xs text-muted-foreground">
                {cluster.edge_count} connections
              </span>
              <Badge variant="outline" className="text-xs">
                {cluster.dominant_type}
              </Badge>
            </div>
          </SheetDescription>
        </SheetHeader>

        {/* Interactive Force-Directed Graph */}
        <div className="relative w-full aspect-square rounded-xl overflow-hidden">
          <ForceDirectedGraph
            cluster={cluster}
            studentDetails={studentDetails}
            onEdgeClick={(edge) => onCompare(cluster, edge)}
            onNodeClick={() => {
              // Could open student detail panel here
            }}
            width={600}
            height={600}
          />
        </div>

        {/* Edge list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Clone Pairs ({cluster.edges.length})
          </p>

          <div className="space-y-1.5">
            {cluster.edges.map((edge, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2 font-mono text-sm min-w-0">
                    <span
                      className="truncate max-w-[80px] text-foreground"
                      title={edge.student_a}
                    >
                      {edge.student_a.substring(0, 8)}
                    </span>
                    <span className="text-muted-foreground shrink-0">↔</span>
                    <span
                      className="truncate max-w-[80px] text-foreground"
                      title={edge.student_b}
                    >
                      {edge.student_b.substring(0, 8)}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {edge.clone_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {edge.match_count} match{edge.match_count !== 1 ? "es" : ""}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <SimilarityScore score={edge.confidence} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCompare(cluster, edge)}
                    className="gap-1.5"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Compare
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best match CTA */}
        {maxEdge && (
          <div className="mt-auto pt-4 border-t">
            <Button
              className="w-full gap-2"
              onClick={() => onCompare(cluster, maxEdge)}
            >
              <GitCompare className="h-4 w-4" />
              Compare Best Match ({Math.round(maxEdge.confidence * 100)}% similarity)
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
