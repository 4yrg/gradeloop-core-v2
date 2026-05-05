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
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CollusionGroup, CollusionEdge, StudentDetails } from "@/types/cipas";

interface ClusterGraphSheetProps {
  cluster: CollusionGroup | null;
  studentDetails?: Record<string, StudentDetails>;
  open: boolean;
  onClose: () => void;
  onCompare: (cluster: CollusionGroup, edge: CollusionEdge) => void;
}

function strongestEdgeForStudent(cluster: CollusionGroup, studentId: string): CollusionEdge | null {
  const incident = cluster.edges.filter(
    (e) => e.student_a === studentId || e.student_b === studentId,
  );
  if (incident.length === 0) return null;
  return incident.reduce((best, e) => (e.confidence > best.confidence ? e : best), incident[0]);
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
  const pairsSorted = [...cluster.edges].sort((a, b) => b.confidence - a.confidence);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        disableAnimation
        className="w-full sm:max-w-md flex flex-col gap-4 p-4 overflow-hidden"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle>Cluster {label}</SheetTitle>
          <SheetDescription>
            {cluster.member_count} students · {cluster.edges.length} similar pairs. Choose a student (strongest
            match) or a pair to open the side-by-side code comparison.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Students</p>
            <div className="flex flex-wrap gap-2">
              {cluster.member_ids.map((id) => {
                const edge = strongestEdgeForStudent(cluster, id);
                const display =
                  studentDetails[id]?.full_name?.trim() ||
                  `${id.length > 12 ? `${id.slice(0, 12)}…` : id}`;
                return (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-8 max-w-full justify-start text-left font-normal"
                    title={id}
                    disabled={!edge}
                    onClick={() => edge && onCompare(cluster, edge)}
                  >
                    <span className="truncate text-xs">{display}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            <p className="text-xs font-medium text-muted-foreground mb-2">Similar pairs</p>
            <ScrollArea className="flex-1 rounded-md border border-border">
              <ul className="p-1">
                {pairsSorted.map((edge, i) => (
                  <li key={`${edge.student_a}-${edge.student_b}-${i}`}>
                    <button
                      type="button"
                      className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted"
                      onClick={() => onCompare(cluster, edge)}
                    >
                      <div className="font-mono text-xs text-foreground break-all">
                        {edge.student_a} ↔ {edge.student_b}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {edge.clone_type} · {Math.round(edge.confidence * 100)}% similar
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
