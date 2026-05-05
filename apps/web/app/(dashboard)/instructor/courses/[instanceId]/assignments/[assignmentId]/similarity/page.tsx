"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  getSimilarityReport,
  clusterAssignment,
  getAnnotations,
  detectAICode,
  getSemanticSimilarity,
  saveSubmissionAnalysis,
  getBatchSubmissionCode,
} from "@/lib/api/cipas-client";
import { instructorAssessmentsApi, assessmentsApi } from "@/lib/api/assessments";
import type { AssignmentClusterResponse, CollusionGroup, CollusionEdge, SubmissionItem, AnnotationResponse } from "@/types/cipas";
import type { AssignmentResponse, SubmissionResponse } from "@/types/assessments.types";
import { SectionHeader } from "@/components/instructor/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTable, type ColumnDef } from "@/components/instructor/data-table";
import { NetworkGraph } from "@/components/instructor/similarity/network-graph";
import { SummaryStats } from "@/components/instructor/similarity/summary-stats";
import { SimilarityBadge, SimilarityScore } from "@/components/instructor/similarity/similarity-badge";
import { SemanticSimilarityCompact } from "@/components/ui/semantic-similarity-badge";
import { ClusterGraphSheet } from "@/components/instructor/similarity/cluster-graph-sheet";
import { DiffSheet } from "@/components/instructor/similarity/diff-sheet";
import {
  RefreshCw,
  Download,
  Search,
  AlertCircle,
  Loader2,
  Eye,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Columns2,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";

// Judge0 language IDs → CIPAS accepted language strings
const JUDGE0_TO_CIPAS: Record<number, string> = {
  62: "java", 91: "java",               // Java 13 / 17
  70: "python", 71: "python", 72: "python", // Python 2 / 3.8 / 3.11
  48: "c", 49: "c", 50: "c",           // C (GCC 7/8/9)
  51: "csharp",                         // C# (Mono)
  52: "c", 53: "c", 54: "c",           // C++ (treated as C for AST purposes)
};

function toCipasLanguage(languageId: number | string | undefined): string {
  if (typeof languageId === "number") {
    return JUDGE0_TO_CIPAS[languageId] ?? "python";
  }
  if (typeof languageId === "string") {
    const s = languageId.toLowerCase();
    if (s === "java") return "java";
    if (s === "c" || s === "cpp" || s === "c++") return "c";
    if (s === "csharp" || s === "c#") return "csharp";
    return "python";
  }
  return "python";
}

/** Judge0 Java 17 — matches `JUDGE0_TO_CIPAS` above. */
const JAVA_SEED_LANGUAGE_ID = 62;

export default function SimilarityOverviewPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  const isHydrated = useAuthStore((s) => s.isHydrated);

  const [report, setReport] = React.useState<AssignmentClusterResponse | null>(null);
  const [assignment, setAssignment] = React.useState<AssignmentResponse | null>(null);
  const [annotations, setAnnotations] = React.useState<AnnotationResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [thresholdFilter, setThresholdFilter] = React.useState("0.7");
  const [sortBy, setSortBy] = React.useState("high-risk");
  const [statusFilter, setStatusFilter] = React.useState("all");

  // Per-submission CIPAS metrics state
  const [submissionMetrics, setSubmissionMetrics] = React.useState<Map<string, {
    aiLikelihood: number;
    isAIGenerated: boolean;
    aiConfidence: number;
    semanticSimilarity: number | null;
    isAnalyzing: boolean;
  }>>(new Map());
  const [isAnalyzingSubmissions, setIsAnalyzingSubmissions] = React.useState(false);

  // Diagnostics panel toggle (per_submission fragment/pair/clone breakdown)
  const [showDiagnostics, setShowDiagnostics] = React.useState(false);

  // Sheet state: cluster graph panel
  const [graphSheetCluster, setGraphSheetCluster] = React.useState<CollusionGroup | null>(null);
  const [graphSheetOpen, setGraphSheetOpen] = React.useState(false);

  // Sheet state: diff viewer panel
  const [diffSheetCluster, setDiffSheetCluster] = React.useState<CollusionGroup | null>(null);
  const [diffSheetEdge, setDiffSheetEdge] = React.useState<CollusionEdge | null>(null);
  const [diffSheetOpen, setDiffSheetOpen] = React.useState(false);

  // Fetch cached report, assignment data, and annotations
  React.useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        const [cachedReport, assignments] = await Promise.all([
          getSimilarityReport(assignmentId),
          instructorAssessmentsApi.listMyAssignments(),
        ]);

        if (mounted) {
          setReport(cachedReport);
          const found = assignments.find((a) => a.id === assignmentId);
          if (found) {
            setAssignment(found);
          } else {
            try {
              const a = await assessmentsApi.getAssignment(assignmentId);
              if (mounted) setAssignment(a);
            } catch {
              if (mounted) setAssignment(null);
            }
          }

          // Fetch annotations if report exists
          if (cachedReport) {
            try {
              const annotationsData = await getAnnotations(assignmentId);
              setAnnotations(annotationsData);
            } catch {
              // Non-critical if annotations fail to load
              setAnnotations([]);
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load similarity report");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchData();
    return () => {
      mounted = false;
    };
  }, [assignmentId]);

  // Analyze submissions for AI likelihood and semantic similarity
  React.useEffect(() => {
    // Do not start until auth hydration is complete — avoids sending requests
    // with a null access token during the brief window between component mount
    // and the AuthProvider's hydrateSession() resolving.
    if (!isHydrated || !report || !assignment) return;

    async function analyzeSubmissions() {
      try {
        setIsAnalyzingSubmissions(true);

        // Fetch all submissions for this assignment
        const submissions = await instructorAssessmentsApi.listSubmissions(assignmentId);

        // Filter out submissions that have already been analyzed
        const unanalyzedSubmissions = submissions.filter(
          (sub) => !sub.analyzed_at && !submissionMetrics.has(sub.id)
        );

        if (unanalyzedSubmissions.length === 0) {
          setIsAnalyzingSubmissions(false);
          return;
        }

        // Fetch instructor template if available
        let instructorTemplate: string | null = null;
        const templateId = assignment?.instructor_template_id;
        if (templateId) {
          try {
            const templateCode = await assessmentsApi.getSubmissionCode(templateId);
            instructorTemplate = templateCode.code;
          } catch (err) {
            console.warn("Could not fetch instructor template:", err);
          }
        }

        // Analyze each unanalyzed submission
        for (const submission of unanalyzedSubmissions) {
          try {
            // Mark as analyzing
            setSubmissionMetrics((prev) =>
              new Map(prev).set(submission.id, {
                aiLikelihood: 0,
                isAIGenerated: false,
                aiConfidence: 0,
                semanticSimilarity: null,
                isAnalyzing: true,
              })
            );

            // Fetch submission code
            const codeData = await assessmentsApi.getSubmissionCode(submission.id);
            const sourceCode = codeData.code || "";

            if (!sourceCode.trim()) {
              setSubmissionMetrics((prev) => {
                const updated = new Map(prev);
                updated.delete(submission.id);
                return updated;
              });
              continue;
            }

            // Run AI detection
            const aiResult = await detectAICode(sourceCode);

            // Calculate semantic similarity if template exists
            let semanticSimilarity: number | null = null;
            if (instructorTemplate && instructorTemplate.trim()) {
              try {
                semanticSimilarity = await getSemanticSimilarity(
                  sourceCode,
                  instructorTemplate
                );
                // Convert to percentage (0-100)
                semanticSimilarity = semanticSimilarity * 100;
              } catch (err) {
                console.error(
                  `Semantic similarity failed for ${submission.id}:`,
                  err
                );
              }
            }

            // Update local state
            setSubmissionMetrics((prev) =>
              new Map(prev).set(submission.id, {
                aiLikelihood: aiResult.ai_likelihood,
                isAIGenerated: aiResult.is_ai_generated,
                aiConfidence: aiResult.confidence,
                semanticSimilarity,
                isAnalyzing: false,
              })
            );

            // Persist to database
            await saveSubmissionAnalysis(submission.id, {
              ai_likelihood: aiResult.ai_likelihood,
              human_likelihood: aiResult.human_likelihood,
              is_ai_generated: aiResult.is_ai_generated,
              ai_confidence: aiResult.confidence,
              semantic_similarity_score: semanticSimilarity,
            });
          } catch (err) {
            console.error(`Analysis failed for submission ${submission.id}:`, err);
            setSubmissionMetrics((prev) => {
              const updated = new Map(prev);
              updated.delete(submission.id);
              return updated;
            });
          }
        }
      } catch (err) {
        console.error("Failed to analyze submissions:", err);
      } finally {
        setIsAnalyzingSubmissions(false);
      }
    }

    analyzeSubmissions();
  }, [report, assignment, assignmentId, isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run similarity analysis (CIPAS clusterAssignment + real submission code).
  // Java assignments: first refresh demo submissions via server route (requires DEMO_* in apps/web/.env.local).
  const handleRunAnalysis = async () => {
    try {
      setIsRunning(true);
      setError(null);

      // Bail out if auth hydration hasn't completed yet (token is null).
      // InstructorGuard normally prevents renders before isHydrated, but
      // this guards against any edge case where the function is called early.
      if (!isHydrated || !useAuthStore.getState().accessToken) {
        setError("Session not ready. Please wait a moment and try again, or refresh the page.");
        return;
      }

      const accessToken = useAuthStore.getState().accessToken;

      if (assignment?.language_id === JAVA_SEED_LANGUAGE_ID) {
        const seedRes = await fetch(`/api/instructor/seed-demo/${assignmentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const seedData = (await seedRes.json()) as {
          error?: string;
          results?: Array<{ status: string; detail?: string }>;
        };
        if (!seedRes.ok) {
          setError(seedData.error ?? `Demo seed request failed (${seedRes.status})`);
          return;
        }
      }

      // Fetch all submissions; prefer latest only to avoid duplicates
      const allSubmissions = await instructorAssessmentsApi.listSubmissions(assignmentId);
      const latestSubs = allSubmissions.filter((s) => s.is_latest);
      const targets: SubmissionResponse[] = latestSubs.length >= 2 ? latestSubs : allSubmissions;

      if (targets.length < 2) {
        setError("At least 2 submissions are required for similarity analysis");
        return;
      }

      // Batch-fetch source code with auth (falls back to parallel individual calls)
      const codeMap = await getBatchSubmissionCode(targets.map((s) => s.id));

      const submissionsWithCode: SubmissionItem[] = targets
        .map((sub) => ({
          submission_id: sub.id,
          // Priority: user_id (individual) → group_id (group assignment) → sub.id (always unique).
          // Falling back to a literal "unknown" collapses all submissions to the same student_id,
          // causing CIPAS's add_match guard (student_a == student_b → drop) to silently discard
          // every candidate pair, producing 0 edges and 0 clusters.
          student_id: sub.user_id ?? sub.group_id ?? sub.id,
          source_code: codeMap[sub.id]?.code?.trim() ?? "",
        }))
        .filter((s) => s.source_code.length > 0);

      if (submissionsWithCode.length < 2) {
        setError(
          `Only ${submissionsWithCode.length} of ${targets.length} submissions have source code. ` +
          `Ensure students have saved their code before running analysis.`,
        );
        return;
      }

      // Map Judge0 integer language_id → CIPAS language string (java/python/c/csharp)
      const cipasLanguage = toCipasLanguage(assignment?.language_id);

      // Optionally register instructor template to suppress starter-code matches
      let instructorTemplate: string | undefined;
      if (assignment?.instructor_template_id) {
        try {
          const templateCode = await assessmentsApi.getSubmissionCode(
            assignment.instructor_template_id
          );
          instructorTemplate = templateCode.code || undefined;
        } catch (err) {
          console.warn("Could not fetch instructor template for clustering:", err);
        }
      }

      // Run CIPAS syntactic clone clustering.
      //
      // IMPORTANT: lsh_threshold (0.3) is the MinHash candidate-retrieval threshold —
      // it controls how broadly the LSH index searches for clone candidates.
      // Keep it at the backend default (0.3) so the cascade sees all potential pairs.
      //
      // The UI "Threshold" filter (thresholdFilter) is a separate display-only filter
      // that hides low-confidence clusters from the table — it does NOT affect detection.
      const clusterResponse = await clusterAssignment({
        assignment_id: assignmentId,
        language: cipasLanguage,
        submissions: submissionsWithCode,
        instructor_template: instructorTemplate,
        lsh_threshold: 0.3,   // candidate retrieval breadth — do NOT use UI filter here
        min_confidence: 0.0,  // include all detected edges; UI filter handles display
      });

      setReport(clusterResponse);
    } catch (err) {
      // Surface a clear message for auth failures so users know to re-login
      // rather than seeing a generic error.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("unauthenticated")) {
        setError("Session expired — please refresh the page or log in again.");
      } else {
        setError(msg || "Failed to run similarity analysis");
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      const { exportSimilarityReport } = await import("@/lib/api/cipas-client");
      const blob = await exportSimilarityReport(assignmentId, "csv");

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `similarity-report-${assignmentId}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
      setError("Failed to export report. Please try again.");
    }
  };

  // Filter and sort clusters
  const filteredClusters = React.useMemo(() => {
    if (!report) return [];

    let clusters = [...report.collusion_groups];

    // Apply search filter
    if (searchQuery) {
      clusters = clusters.filter((c) =>
        c.member_ids.some((id) => id.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply threshold filter
    const threshold = parseFloat(thresholdFilter);
    clusters = clusters.filter((c) => c.max_confidence >= threshold);

    // Apply annotation status filter
    if (statusFilter !== "all") {
      clusters = clusters.filter((c) => {
        const annotation = annotations.find((a) => a.group_id === c.group_id.toString());
        return annotation?.status === statusFilter;
      });
    }

    // Sort
    if (sortBy === "high-risk") {
      clusters.sort((a, b) => b.max_confidence - a.max_confidence);
    } else if (sortBy === "size") {
      clusters.sort((a, b) => b.member_count - a.member_count);
    }

    return clusters;
  }, [report, searchQuery, thresholdFilter, sortBy, statusFilter, annotations]);

  /** Edges in filtered clusters (deduped per cluster + student pair), for opening diff without using the graph. */
  const similarPairRows = React.useMemo(() => {
    const threshold = parseFloat(thresholdFilter);
    const seen = new Set<string>();
    const rows: { cluster: CollusionGroup; edge: CollusionEdge }[] = [];
    for (const c of filteredClusters) {
      for (const e of c.edges) {
        if (e.confidence < threshold) continue;
        const lo = e.student_a < e.student_b ? e.student_a : e.student_b;
        const hi = e.student_a < e.student_b ? e.student_b : e.student_a;
        const k = `${c.group_id}|${lo}|${hi}`;
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push({ cluster: c, edge: e });
      }
    }
    rows.sort((a, b) => b.edge.confidence - a.edge.confidence);
    return rows;
  }, [filteredClusters, thresholdFilter]);

  // Calculate summary stats
  const stats = React.useMemo(() => {
    if (!report) {
      return { highRisk: 0, mediumRisk: 0, lowRisk: 0, flaggedCases: 0 };
    }

    const highRisk = report.collusion_groups.filter((c) => c.max_confidence >= 0.85).length;
    const mediumRisk = report.collusion_groups.filter(
      (c) => c.max_confidence >= 0.75 && c.max_confidence < 0.85
    ).length;
    const lowRisk = report.collusion_groups.filter((c) => c.max_confidence < 0.75).length;

    // Count unique flagged students
    const flaggedStudents = new Set<string>();
    report.collusion_groups.forEach((group) => {
      group.member_ids.forEach((id) => flaggedStudents.add(id));
    });

    return { highRisk, mediumRisk, lowRisk, flaggedCases: flaggedStudents.size };
  }, [report]);

  // Table columns
  const columns: ColumnDef<CollusionGroup>[] = [
    {
      accessorKey: "group_id",
      header: "Cluster ID",
      cell: ({ row }) => {
        const clusterId = String.fromCharCode(64 + row.original.group_id);
        const annotation = annotations.find((a) => a.group_id === row.original.group_id.toString());

        const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
          confirmed_plagiarism: { icon: "⚠", color: "text-red-600" },
          false_positive: { icon: "✓", color: "text-green-600" },
        };

        const status = annotation?.status && statusConfig[annotation.status];

        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sm relative">
              {clusterId}
              {status && (
                <span className={`absolute -top-1 -right-1 text-xs ${status.color}`}>
                  {status.icon}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{row.original.dominant_type}</span>
              {annotation && (
                <span className="text-xs text-muted-foreground capitalize">
                  {annotation.status.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "member_count",
      header: "Submissions",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.member_count} students</span>
      ),
    },
    {
      accessorKey: "max_confidence",
      header: "Avg Similarity",
      cell: ({ row }) => <SimilarityScore score={row.original.max_confidence} showBar />,
    },
    {
      accessorKey: "risk",
      header: "Risk Level",
      cell: ({ row }) => <SimilarityBadge similarity={row.original.max_confidence} />,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Action</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewCluster(row.original)}
            className="gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" />
            View Cluster
          </Button>
        </div>
      ),
    },
  ];

  const handleViewCluster = (cluster: CollusionGroup) => {
    setGraphSheetCluster(cluster);
    setGraphSheetOpen(true);
  };

  const handleOpenDiff = (cluster: CollusionGroup, edge: CollusionEdge) => {
    setDiffSheetCluster(cluster);
    setDiffSheetEdge(edge);
    setGraphSheetOpen(false);
    setDiffSheetOpen(true);
  };

  if (error && !report) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // No report yet - show empty state
  if (!report) {
    return (
      <div className="p-8">
        <SectionHeader
          title="Similarity Analysis"
          description="Detect code similarity and potential plagiarism across submissions"
        />

        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analysis Run Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Run similarity analysis to detect code clones and potential collusion among submissions.
              This may take 10-30 seconds depending on the number of submissions.
              {assignment?.language_id === JAVA_SEED_LANGUAGE_ID && (
                <>
                  {" "}
                  For Java, similar demo submissions are synced first (server{" "}
                  <span className="font-mono text-xs">DEMO_*</span> in{" "}
                  <span className="font-mono text-xs">apps/web/.env.local</span>).
                </>
              )}
            </p>
            <Button onClick={handleRunAnalysis} disabled={isRunning} size="lg">
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Run Similarity Analysis
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8 pb-16">
      <SectionHeader
        title="Similarity Overview"
        description={`Analyzed ${report.submission_count} submissions • ${report.collusion_groups.length} clusters detected`}
        action={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button onClick={handleRunAnalysis} disabled={isRunning}>
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Re-run Analysis
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Min. Confidence
            </span>
            <Select value={thresholdFilter} onValueChange={setThresholdFilter}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">50%</SelectItem>
                <SelectItem value="0.6">60%</SelectItem>
                <SelectItem value="0.7">70%</SelectItem>
                <SelectItem value="0.8">80%</SelectItem>
                <SelectItem value="0.9">90%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-6 w-px bg-border mx-2" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sort By
            </span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high-risk">High Risk First</SelectItem>
                <SelectItem value="size">Cluster Size</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-6 w-px bg-border mx-2" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status
            </span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clusters</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="confirmed_plagiarism">Confirmed</SelectItem>
                <SelectItem value="false_positive">False Positive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 h-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Graph + Summary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Submission similarity network
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <NetworkGraph
                clusters={filteredClusters}
                onClusterClick={handleViewCluster}
                onEdgeClick={handleOpenDiff}
              />
              {similarPairRows.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 dark:bg-muted/10">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Similar pairs</p>
                      <p className="text-xs text-muted-foreground">
                        Click a row to open the side-by-side diff (same as clicking a link in the graph).
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {similarPairRows.length} pair{similarPairRows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ScrollArea className="h-[min(280px,40vh)]">
                    <ul className="p-2 space-y-1">
                      {similarPairRows.map(({ cluster, edge }) => {
                        const clusterLetter = String.fromCharCode(64 + cluster.group_id);
                        return (
                          <li key={`${cluster.group_id}-${edge.student_a}-${edge.student_b}`}>
                            <button
                              type="button"
                              onClick={() => handleOpenDiff(cluster, edge)}
                              className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/80 transition-colors border border-transparent hover:border-border"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                                {clusterLetter}
                              </span>
                              <span className="min-w-0 flex-1 font-mono text-xs">
                                <span className="text-foreground">
                                  {edge.student_a.slice(0, 10)}
                                  {edge.student_a.length > 10 ? "…" : ""}
                                </span>
                                <span className="text-muted-foreground mx-1">↔</span>
                                <span className="text-foreground">
                                  {edge.student_b.slice(0, 10)}
                                  {edge.student_b.length > 10 ? "…" : ""}
                                </span>
                                <span className="block text-[11px] text-muted-foreground mt-0.5">
                                  {edge.clone_type} · {Math.round(edge.confidence * 100)}%
                                </span>
                              </span>
                              <Columns2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <SummaryStats
            totalSubmissions={report.submission_count}
            flaggedCases={stats.flaggedCases}
            highRisk={stats.highRisk}
            mediumRisk={stats.mediumRisk}
            lowRisk={stats.lowRisk}
            aiInsight={
              stats.highRisk > 0
                ? `${stats.highRisk} high-confidence clusters detected. Review submissions for structural similarities and shared logic patterns.`
                : undefined
            }
          />
        </div>
      </div>

      {/* Per-Submission Metrics Table */}
      {submissionMetrics.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Individual Submission Metrics</span>
              {isAnalyzingSubmissions && (
                <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing submissions...
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">Submission ID</th>
                    <th className="p-3 text-left font-medium">AI Likelihood</th>
                    <th className="p-3 text-left font-medium">AI Generated</th>
                    <th className="p-3 text-left font-medium">Semantic Similarity</th>
                    <th className="p-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Array.from(submissionMetrics.entries()).map(([submissionId, metrics]) => (
                    <tr key={submissionId} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">
                        {submissionId.substring(0, 8)}...
                      </td>
                      <td className="p-3">
                        {metrics.isAnalyzing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${metrics.aiLikelihood > 0.7
                                    ? "bg-red-500"
                                    : metrics.aiLikelihood > 0.4
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                  }`}
                                style={{ width: `${metrics.aiLikelihood * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">
                              {(metrics.aiLikelihood * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {metrics.isAnalyzing ? (
                          "..."
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${metrics.isAIGenerated
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              }`}
                          >
                            {metrics.isAIGenerated ? "Likely AI" : "Likely Human"}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {metrics.isAnalyzing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : metrics.semanticSimilarity !== null ? (
                          <SemanticSimilarityCompact
                            score={metrics.semanticSimilarity}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        {metrics.isAnalyzing ? (
                          <span className="text-xs text-muted-foreground">Analyzing...</span>
                        ) : (
                          <span className="text-xs text-green-600 dark:text-green-400">✓ Stored</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Syntactic Analysis Diagnostics — per-submission fragment/pair/clone breakdown */}
      {report.per_submission.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer select-none" onClick={() => setShowDiagnostics((v) => !v)}>
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Syntactic Analysis Details
                {report.per_submission.some((s) => s.fragment_count === 0) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {report.per_submission.filter((s) => s.fragment_count === 0).length} submission(s) produced no fragments
                  </span>
                )}
              </span>
              {showDiagnostics ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal mt-1">
              If 0 clusters were detected, check for submissions with 0 fragments (code too short, wrong language) or 0 candidate pairs (insufficient LSH overlap).
            </p>
          </CardHeader>
          {showDiagnostics && (
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium text-xs">Submission ID</th>
                      <th className="p-3 text-left font-medium text-xs">Student ID</th>
                      <th className="p-3 text-center font-medium text-xs">Fragments</th>
                      <th className="p-3 text-center font-medium text-xs">Candidate Pairs</th>
                      <th className="p-3 text-center font-medium text-xs">Confirmed Clones</th>
                      <th className="p-3 text-left font-medium text-xs">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.per_submission.map((sub) => (
                      <tr key={sub.submission_id} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{sub.submission_id.substring(0, 8)}…</td>
                        <td className="p-3 font-mono text-xs">{sub.student_id.substring(0, 8)}…</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold ${
                            sub.fragment_count === 0
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          }`}>
                            {sub.fragment_count}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold ${
                            sub.candidate_pair_count === 0
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {sub.candidate_pair_count}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold ${
                            sub.confirmed_clone_count > 0
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {sub.confirmed_clone_count}
                          </span>
                        </td>
                        <td className="p-3">
                          {sub.errors.length > 0 ? (
                            <span className="text-xs text-red-600 dark:text-red-400">
                              {sub.errors.join("; ")}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Clusters Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detected Clusters</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredClusters}
            searchPlaceholder="Search clusters..."
          />
        </CardContent>
      </Card>

      {/* Cluster graph sheet — opens from Detected Clusters table "View Cluster" */}
      <ClusterGraphSheet
        cluster={graphSheetCluster}
        open={graphSheetOpen}
        onClose={() => setGraphSheetOpen(false)}
        onCompare={handleOpenDiff}
      />

      {/* Diff sheet — opens from ClusterGraphSheet's Compare buttons */}
      <DiffSheet
        cluster={diffSheetCluster}
        initialEdge={diffSheetEdge}
        assignmentId={assignmentId}
        open={diffSheetOpen}
        onClose={() => {
          setDiffSheetOpen(false);
          setDiffSheetEdge(null);
        }}
      />
    </div>
  );
}
