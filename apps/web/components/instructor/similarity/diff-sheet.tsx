"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Users } from "lucide-react";
import { CollusionGroupCard } from "@/components/clone-detector/CollusionGroupCard";
import { instructorAssessmentsApi, assessmentsApi } from "@/lib/api/assessments";
import type { CollusionGroup, CollusionEdge, SubmissionItem } from "@/types/cipas";
import type { SubmissionResponse } from "@/types/assessments.types";
import { getStudentName } from "@/lib/dummy-students";

interface DiffSheetProps {
  cluster: CollusionGroup | null;
  /** The edge to focus on by default (optional — first edge used as fallback) */
  initialEdge?: CollusionEdge | null;
  assignmentId: string;
  open: boolean;
  onClose: () => void;
  /** Pre-loaded submissions to skip API fetch (useful for dummy/demo data) */
  preloadedSubmissions?: SubmissionItem[];
}

export function DiffSheet({
  cluster,
  initialEdge,
  assignmentId,
  open,
  onClose,
  preloadedSubmissions,
}: DiffSheetProps) {
  const [submissions, setSubmissions] = React.useState<SubmissionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch code whenever the sheet opens for a cluster
  React.useEffect(() => {
    if (!open || !cluster) return;

    // Skip API fetch if preloaded submissions are provided
    if (preloadedSubmissions && preloadedSubmissions.length > 0) {
      setSubmissions(preloadedSubmissions);
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;

    async function loadSubmissions() {
      setIsLoading(true);
      setError(null);

      try {
        const rawSubs: SubmissionResponse[] =
          await instructorAssessmentsApi.listSubmissions(assignmentId);

        // Only fetch code for members of this cluster (by student_id)
        // member_ids in CollusionGroup are student_id values
        const memberSet = new Set(cluster!.member_ids);
        const relevant = rawSubs.filter(
          (s) => s.user_id && memberSet.has(s.user_id)
        );

        // Fall back to all latest submissions if member filtering yields nothing
        // (can happen when member_ids are submission_ids instead of user_ids)
        const targets = relevant.length > 0 ? relevant : rawSubs.filter((s) => s.is_latest);

        const withCode = await Promise.all(
          targets.map(async (sub) => {
            try {
              const codeRes = await assessmentsApi.getSubmissionCode(sub.id);
              return {
                submission_id: sub.id,
                student_id: sub.user_id ?? sub.id,
                source_code: codeRes.code ?? "",
              } satisfies SubmissionItem;
            } catch {
              return null;
            }
          })
        );

        if (mounted) {
          setSubmissions(withCode.filter((s): s is SubmissionItem => s !== null));
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load submissions");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSubmissions();

    return () => {
      mounted = false;
    };
  // Re-run when sheet opens or the cluster changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cluster?.group_id, assignmentId, preloadedSubmissions]);

  // Build a cluster copy that pre-selects the desired initial edge by
  // reordering edges so the focused one comes first (CollusionGroupCard picks edges[0])
  const clusterWithEdgeFirst = React.useMemo<CollusionGroup | null>(() => {
    if (!cluster) return null;
    if (!initialEdge) return cluster;

    const reordered = [
      initialEdge,
      ...cluster.edges.filter(
        (e) => !(e.student_a === initialEdge.student_a && e.student_b === initialEdge.student_b)
      ),
    ];
    return { ...cluster, edges: reordered };
  }, [cluster, initialEdge]);

  if (!cluster) return null;

  const label = String.fromCharCode(64 + cluster.group_id);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* Fixed header */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-3">
            Diff View — Cluster {label}
            {initialEdge && (
              <span className="text-sm font-normal text-muted-foreground">
                {getStudentName(initialEdge.student_a)} ↔ {getStudentName(initialEdge.student_b)}
              </span>
            )}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {cluster.member_count} students
              </span>
              <Badge variant="outline" className="text-xs">
                {cluster.dominant_type}
              </Badge>
              {initialEdge && (
                <Badge variant="secondary" className="text-xs">
                  {Math.round(initialEdge.confidence * 100)}% similarity
                </Badge>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-[480px] w-full" />
            </div>
          )}

          {!isLoading && error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && clusterWithEdgeFirst && (
            <CollusionGroupCard
              group={clusterWithEdgeFirst}
              submissions={submissions}
              index={cluster.group_id - 1}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
