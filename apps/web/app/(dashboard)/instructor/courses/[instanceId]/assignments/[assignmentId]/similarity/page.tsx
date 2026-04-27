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
} from "@/lib/api/cipas-client";
import { instructorAssessmentsApi, assessmentsApi } from "@/lib/api/assessments";
import type { AssignmentClusterResponse, CollusionGroup, CollusionEdge, SubmissionItem, AnnotationResponse } from "@/types/cipas";
import type { AssignmentResponse, SubmissionResponse } from "@/types/assessments.types";
import { SectionHeader } from "@/components/instructor/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

export default function SimilarityOverviewPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;

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
          if (found) setAssignment(found);

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
    if (!report || !assignment) return;

    async function analyzeSubmissions() {
      if (!assignment) return;
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
  }, [report, assignment, assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run similarity analysis
  const handleRunAnalysis = async () => {
    try {
      setIsRunning(true);
      setError(null);

      // Fetch all submissions for this assignment
      const submissions = await instructorAssessmentsApi.listSubmissions(assignmentId);

      if (submissions.length < 2) {
        setError("At least 2 submissions are required for similarity analysis");
        return;
      }

      // Fetch code for each submission
      const submissionsWithRawCode = await Promise.all(
        submissions.map(async (sub: SubmissionResponse) => {
          try {
            const code = await assessmentsApi.getSubmissionCode(sub.id);
            return {
              submission_id: sub.id,
              student_id: sub.user_id || "unknown",
              source_code: code.code || "",
            };
          } catch {
            return null;
          }
        })
      );

      const submissionsWithCode = submissionsWithRawCode.filter(
        (r): r is SubmissionItem => r !== null
      );

      if (submissionsWithCode.length < 2) {
        setError("Not enough submissions with code to analyze");
        return;
      }

      // Determine language from assignment (default to Python)
      const language = assignment?.language_id || "python";
      const languageStr = typeof language === "string" ? language.toLowerCase() : "python";

      // Fetch instructor template if available
      let instructorTemplate: string | undefined;
      if (assignment?.instructor_template_id) {
        try {
          const templateCode = await assessmentsApi.getSubmissionCode(
            assignment.instructor_template_id
          );
          instructorTemplate = templateCode.code || undefined;
          console.info(`Fetched instructor template: ${instructorTemplate?.length || 0} characters`);
        } catch (err) {
          console.warn("Could not fetch instructor template for clustering:", err);
        }
      }

      // Run clustering with syntactic clone detection
      const clusterResponse = await clusterAssignment({
        assignment_id: assignmentId,
        language: languageStr,
        submissions: submissionsWithCode,
        instructor_template: instructorTemplate,
        lsh_threshold: parseFloat(thresholdFilter),
        min_confidence: 0.0,
      });

      setReport(clusterResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run similarity analysis");
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
              Threshold
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
                Network Cluster Visualization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NetworkGraph
                clusters={filteredClusters.slice(0, 4)}
                onClusterClick={handleViewCluster}
              />
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

      {/* Cluster graph sheet — opens when a bubble in NetworkGraph is clicked */}
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
        onClose={() => setDiffSheetOpen(false)}
      />
    </div>
  );
}
