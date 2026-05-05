"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/instructor/section-header";
import { DiffViewer } from "@/components/clone-detector/DiffViewer";
import { AlertCircle, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import {
  getBatchSubmissionCode,
  getSimilarityReport,
} from "@/lib/api/cipas-client";
import { instructorAssessmentsApi } from "@/lib/api/assessments";
import type { SubmissionItem, CollusionEdge } from "@/types/cipas";

export default function DiffViewerPage({
  params,
}: {
  params: Promise<{ assignmentId: string; instanceId: string }>;
}) {
  const { assignmentId, instanceId } = React.use(params);
  const searchParams = useSearchParams();

  // submission1/submission2 are student_id values from CollusionEdge.student_a/b
  const studentIdA = searchParams.get("submission1");
  const studentIdB = searchParams.get("submission2");

  const [submissions, setSubmissions] = React.useState<SubmissionItem[]>([]);
  const [edge, setEdge] = React.useState<CollusionEdge | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!studentIdA || !studentIdB) {
      setError("Missing submission parameters");
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all submissions for this assignment and the similarity report in parallel
        const [allSubs, report] = await Promise.all([
          instructorAssessmentsApi.listSubmissions(assignmentId),
          getSimilarityReport(assignmentId).catch(() => null),
        ]);

        // Find submission records matching the student IDs
        const sub1Record = allSubs.find((s) => s.user_id === studentIdA);
        const sub2Record = allSubs.find((s) => s.user_id === studentIdB);

        if (!sub1Record || !sub2Record) {
          throw new Error(
            "Could not find submission records for the specified students"
          );
        }

        // Batch-fetch code for both submissions in a single request
        const codeMap = await getBatchSubmissionCode([
          sub1Record.id,
          sub2Record.id,
        ]);

        // Find the matching edge from the similarity report for clone type / confidence
        let matchedEdge: CollusionEdge | null = null;
        if (report) {
          for (const group of report.collusion_groups) {
            const found = group.edges.find(
              (e) =>
                (e.student_a === studentIdA && e.student_b === studentIdB) ||
                (e.student_a === studentIdB && e.student_b === studentIdA)
            );
            if (found) {
              matchedEdge = found;
              break;
            }
          }
        }

        if (mounted) {
          setSubmissions([
            {
              submission_id: sub1Record.id,
              student_id: sub1Record.user_id ?? sub1Record.id,
              source_code: codeMap[sub1Record.id]?.code ?? "",
            },
            {
              submission_id: sub2Record.id,
              student_id: sub2Record.user_id ?? sub2Record.id,
              source_code: codeMap[sub2Record.id]?.code ?? "",
            },
          ]);
          setEdge(matchedEdge);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load submissions"
          );
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchData();
    return () => {
      mounted = false;
    };
  }, [studentIdA, studentIdB, assignmentId]);

  const handleExport = async () => {
    try {
      const { exportSimilarityReport } = await import("@/lib/api/cipas-client");
      const blob = await exportSimilarityReport(assignmentId, "csv");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparison-${studentIdA}-${studentIdB}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
      setError("Failed to export report. Please try again.");
    }
  };

  const backHref = `/instructor/courses/${instanceId}/assignments/${assignmentId}/similarity`;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Link href={backHref}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Overview
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (submissions.length < 2) {
    return (
      <div className="p-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Could not load submission code for comparison.
          </AlertDescription>
        </Alert>
        <Link href={backHref}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Overview
          </Button>
        </Link>
      </div>
    );
  }

  const [sub1, sub2] = submissions;

  return (
    <div className="flex flex-col gap-6 p-8 pb-16">
      <div>
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Overview
          </Button>
        </Link>

        <SectionHeader
          title="Code Comparison"
          description={`Comparing ${sub1.student_id.substring(0, 8)} ↔ ${sub2.student_id.substring(0, 8)}`}
          action={
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          }
        />
      </div>

      {/* Edge summary card */}
      {edge && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 pb-5">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                  Similarity Confidence
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-bold text-primary">
                    {Math.round(edge.confidence * 100)}%
                  </span>
                  <Badge
                    variant={
                      edge.confidence >= 0.85 ? "destructive" : "secondary"
                    }
                    className="mb-1"
                  >
                    {edge.confidence >= 0.85
                      ? "High Risk"
                      : edge.confidence >= 0.7
                        ? "Medium Risk"
                        : "Low Risk"}
                  </Badge>
                </div>
              </div>

              <div className="h-12 w-px bg-border hidden sm:block" />

              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                  Clone Type
                </span>
                <span className="text-2xl font-bold mt-1">
                  {edge.clone_type}
                </span>
              </div>

              <div className="h-12 w-px bg-border hidden sm:block" />

              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                  Fragment Matches
                </span>
                <span className="text-2xl font-bold mt-1">
                  {edge.match_count}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clone type legend */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <span className="font-bold text-muted-foreground uppercase tracking-widest">
              Clone Types:
            </span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-sm" />
              <span>Type-1 (Exact copy)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-sm" />
              <span>Type-2 (Renamed identifiers)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm" />
              <span>Type-3 (Structural copy)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-400 rounded-sm" />
              <span>Cloned lines (diff view)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-side diff viewer */}
      <DiffViewer
        submissions={submissions}
        initialLeftId={studentIdA!}
        initialRightId={studentIdB!}
        edge={edge ?? undefined}
      />
    </div>
  );
}
