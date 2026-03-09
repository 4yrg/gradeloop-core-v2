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
import { GitCompare, Users, Link2 } from "lucide-react";
import type { CollusionGroup, CollusionEdge } from "@/types/cipas";
import { cn } from "@/lib/utils";

interface ClusterGraphSheetProps {
  cluster: CollusionGroup | null;
  open: boolean;
  onClose: () => void;
  onCompare: (cluster: CollusionGroup, edge: CollusionEdge) => void;
}

/** Evenly distribute n nodes around a circle. Returns {x, y} as 0-100 percentages. */
function circlePositions(count: number) {
  const radius = 34;
  const cx = 50;
  const cy = 50;
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

function edgeColor(confidence: number) {
  if (confidence >= 0.85) return "#ef4444";
  if (confidence >= 0.75) return "#f97316";
  return "#eab308";
}

function nodeRingClass(confidence: number) {
  if (confidence >= 0.85) return "ring-red-500";
  if (confidence >= 0.75) return "ring-orange-500";
  return "ring-yellow-500";
}

export function ClusterGraphSheet({
  cluster,
  open,
  onClose,
  onCompare,
}: ClusterGraphSheetProps) {
  if (!cluster) return null;

  const label = String.fromCharCode(64 + cluster.group_id);
  const positions = circlePositions(cluster.member_ids.length);

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

        {/* Graph */}
        <div className="relative w-full aspect-square bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* SVG edges */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {cluster.edges.map((edge, i) => {
              const aIdx = cluster.member_ids.indexOf(edge.student_a);
              const bIdx = cluster.member_ids.indexOf(edge.student_b);
              if (aIdx === -1 || bIdx === -1) return null;
              const a = positions[aIdx];
              const b = positions[bIdx];
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={edgeColor(edge.confidence)}
                  strokeWidth="0.6"
                  strokeOpacity="0.65"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {cluster.member_ids.map((memberId, idx) => {
            const pos = positions[idx];
            const memberEdges = cluster.edges.filter(
              (e) => e.student_a === memberId || e.student_b === memberId
            );
            const avgConf =
              memberEdges.length > 0
                ? memberEdges.reduce((s, e) => s + e.confidence, 0) / memberEdges.length
                : 0;

            return (
              <div
                key={memberId}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div
                  className={cn(
                    "size-10 rounded-full bg-primary ring-2 flex items-center justify-center text-primary-foreground font-bold text-xs shadow-md",
                    nodeRingClass(avgConf)
                  )}
                >
                  {memberId.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-[9px] font-medium bg-white/90 dark:bg-slate-900/90 rounded px-1 max-w-[72px] truncate text-center leading-tight">
                  {memberId}
                </span>
              </div>
            );
          })}
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
