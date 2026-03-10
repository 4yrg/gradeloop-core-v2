"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getSimilarityReport,
  clusterAssignment,
  getSimilarityReportMetadata,
  getAnnotations,
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
import { ClusterCard } from "@/components/instructor/similarity/cluster-card";
import { SummaryStats } from "@/components/instructor/similarity/summary-stats";
import { SimilarityBadge, SimilarityScore } from "@/components/instructor/similarity/similarity-badge";
import { SemanticSimilarityCompact } from "@/components/ui/semantic-similarity-badge";
import { ClusterGraphSheet } from "@/components/instructor/similarity/cluster-graph-sheet";
import { DiffSheet } from "@/components/instructor/similarity/diff-sheet";
import { SemanticDiffSheet } from "@/components/instructor/similarity/semantic-diff-sheet";
import { SemanticSimilaritySection } from "@/components/instructor/similarity/semantic-similarity-section";
import type { SemanticPairComparison, SemanticCluster } from "@/components/instructor/similarity/semantic-similarity-section";
import { StudentAvatar } from "@/components/instructor/similarity/student-avatar";
import { getStudentName } from "@/lib/dummy-students";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Download,
  Search,
  AlertCircle,
  Loader2,
  Eye,
  Filter,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";

export default function SimilarityOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;
  const instanceId = params.instanceId as string;

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

  // Sheet state: cluster graph panel
  const [graphSheetCluster, setGraphSheetCluster] = React.useState<CollusionGroup | null>(null);
  const [graphSheetOpen, setGraphSheetOpen] = React.useState(false);

  // Sheet state: diff viewer panel
  const [diffSheetCluster, setDiffSheetCluster] = React.useState<CollusionGroup | null>(null);
  const [diffSheetEdge, setDiffSheetEdge] = React.useState<CollusionEdge | null>(null);
  const [diffSheetOpen, setDiffSheetOpen] = React.useState(false);

  // Sheet state: semantic diff viewer panel
  const [semanticDiffComparison, setSemanticDiffComparison] = React.useState<SemanticPairComparison | null>(null);
  const [semanticDiffCluster, setSemanticDiffCluster] = React.useState<SemanticCluster | null>(null);
  const [semanticDiffOpen, setSemanticDiffOpen] = React.useState(false);

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

  // Dummy individual submission metrics for demonstration
  const dummySubmissionMetrics = React.useMemo(() => [
    { id: "fc85704b-3a1e-4d9f-b2c8-7e6f5a4d3c2b", aiLikelihood: 0.98, isAIGenerated: true, semanticSimilarity: 82.4 },
    { id: "2b3879d1-8c4f-4e7a-a1b3-9d8e7f6c5a4b", aiLikelihood: 0.84, isAIGenerated: true, semanticSimilarity: 78.9 },
    { id: "27e280dc-5f3e-4b8c-9d1a-2c4b6e8f7a5d", aiLikelihood: 0.72, isAIGenerated: true, semanticSimilarity: 91.2 },
    { id: "5ce3ba63-7d2f-4a6e-8b9c-1e3d5f7a9c8b", aiLikelihood: 0.45, isAIGenerated: false, semanticSimilarity: 85.7 },
    { id: "3e587f9e-4c1a-4d8b-a7e6-2f9b8c3d5a1e", aiLikelihood: 0.31, isAIGenerated: false, semanticSimilarity: 76.3 },
    { id: "93d8cf08-6b5a-4e3d-9c2f-8a7b4d1e6f3c", aiLikelihood: 0.18, isAIGenerated: false, semanticSimilarity: 88.1 },
    { id: "9295e171-2a8d-4f7c-b3e6-5c9a1d4f8b2e", aiLikelihood: 0.09, isAIGenerated: false, semanticSimilarity: 79.5 },
    { id: "d262b9fb-9e3c-4a5d-8b1f-6d7c2e4a9b3f", aiLikelihood: 0.05, isAIGenerated: false, semanticSimilarity: 93.6 },
    { id: "11bf0f07-1c4e-4d6a-a8b3-7f5e9d2c1a8b", aiLikelihood: 0.02, isAIGenerated: false, semanticSimilarity: 84.2 },
    { id: "a4bfc312-8d6f-4c2e-b5a1-3e9d7c8f4b6a", aiLikelihood: null, isAIGenerated: false, semanticSimilarity: 77.8 },
  ], []);

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
      if (assignment && "instructor_template_id" in assignment) {
        const templateId = assignment.instructor_template_id as string | undefined;
        if (templateId) {
          try {
            const templateCode = await assessmentsApi.getSubmissionCode(
              templateId
            );
            instructorTemplate = templateCode.code || undefined;
            console.info(`Fetched instructor template: ${instructorTemplate?.length || 0} characters`);
          } catch (err) {
            console.warn("Could not fetch instructor template for clustering:", err);
          }
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

  // Dummy syntactic clusters for demonstration
  const dummySyntacticClusters: CollusionGroup[] = React.useMemo(() => [
    {
      group_id: 2,
      member_ids: ["5ce3ba63-7d2f-4a6e-8b9c-1e3d5f7a9c8b", "3e587f9e-4c1a-4d8b-a7e6-2f9b8c3d5a1e"],
      member_count: 2,
      max_confidence: 0.82,
      dominant_type: "Type-2",
      edge_count: 1,
      edges: [
        { student_a: "5ce3ba63-7d2f-4a6e-8b9c-1e3d5f7a9c8b", student_b: "3e587f9e-4c1a-4d8b-a7e6-2f9b8c3d5a1e", clone_type: "Type-2", confidence: 0.82, match_count: 4 },
      ],
    },
    {
      group_id: 3,
      member_ids: ["93d8cf08-6b5a-4e3d-9c2f-8a7b4d1e6f3c", "9295e171-2a8d-4f7c-b3e6-5c9a1d4f8b2e", "d262b9fb-9e3c-4a5d-8b1f-6d7c2e4a9b3f"],
      member_count: 3,
      max_confidence: 0.91,
      dominant_type: "Type-1",
      edge_count: 3,
      edges: [
        { student_a: "93d8cf08-6b5a-4e3d-9c2f-8a7b4d1e6f3c", student_b: "9295e171-2a8d-4f7c-b3e6-5c9a1d4f8b2e", clone_type: "Type-1", confidence: 0.91, match_count: 7 },
        { student_a: "93d8cf08-6b5a-4e3d-9c2f-8a7b4d1e6f3c", student_b: "d262b9fb-9e3c-4a5d-8b1f-6d7c2e4a9b3f", clone_type: "Type-1", confidence: 0.88, match_count: 6 },
        { student_a: "9295e171-2a8d-4f7c-b3e6-5c9a1d4f8b2e", student_b: "d262b9fb-9e3c-4a5d-8b1f-6d7c2e4a9b3f", clone_type: "Type-2", confidence: 0.79, match_count: 3 },
      ],
    },
    {
      group_id: 4,
      member_ids: ["11bf0f07-1c4e-4d6a-a8b3-7f5e9d2c1a8b", "a4bfc312-8d6f-4c2e-b5a1-3e9d7c8f4b6a"],
      member_count: 2,
      max_confidence: 0.73,
      dominant_type: "Type-3",
      edge_count: 1,
      edges: [
        { student_a: "11bf0f07-1c4e-4d6a-a8b3-7f5e9d2c1a8b", student_b: "a4bfc312-8d6f-4c2e-b5a1-3e9d7c8f4b6a", clone_type: "Type-3", confidence: 0.73, match_count: 2 },
      ],
    },
  ], []);

  // Dummy source code for demonstration clusters
  const dummySubmissions: SubmissionItem[] = React.useMemo(() => [
    // Cluster B (Type-2: renamed variables, same structure)
    {
      submission_id: "5ce3ba63-7d2f-4a6e-8b9c-1e3d5f7a9c8b",
      student_id: "5ce3ba63-7d2f-4a6e-8b9c-1e3d5f7a9c8b",
      source_code: `def calculate_grade(scores, weights):
    """Calculate weighted average grade."""
    if len(scores) != len(weights):
        raise ValueError("Scores and weights must have same length")
    total = 0
    weight_sum = 0
    for i in range(len(scores)):
        total += scores[i] * weights[i]
        weight_sum += weights[i]
    if weight_sum == 0:
        return 0
    average = total / weight_sum
    if average >= 90:
        return "A"
    elif average >= 80:
        return "B"
    elif average >= 70:
        return "C"
    elif average >= 60:
        return "D"
    else:
        return "F"

def get_student_report(student_id, grades):
    report = {"id": student_id, "grades": []}
    for g in grades:
        report["grades"].append(calculate_grade(g["scores"], g["weights"]))
    return report`,
    },
    {
      submission_id: "3e587f9e-4c1a-4d8b-a7e6-2f9b8c3d5a1e",
      student_id: "3e587f9e-4c1a-4d8b-a7e6-2f9b8c3d5a1e",
      source_code: `def compute_mark(marks, coefficients):
    """Compute weighted average mark."""
    if len(marks) != len(coefficients):
        raise ValueError("Marks and coefficients must have same length")
    result = 0
    coeff_total = 0
    for idx in range(len(marks)):
        result += marks[idx] * coefficients[idx]
        coeff_total += coefficients[idx]
    if coeff_total == 0:
        return 0
    final = result / coeff_total
    if final >= 90:
        return "A"
    elif final >= 80:
        return "B"
    elif final >= 70:
        return "C"
    elif final >= 60:
        return "D"
    else:
        return "F"

def get_learner_summary(learner_id, mark_data):
    summary = {"id": learner_id, "results": []}
    for m in mark_data:
        summary["results"].append(compute_mark(m["marks"], m["coefficients"]))
    return summary`,
    },
    // Cluster C (Type-1: near-identical code)
    {
      submission_id: "93d8cf08-6b5a-4e3d-9c2f-8a7b4d1e6f3c",
      student_id: "93d8cf08-6b5a-4e3d-9c2f-8a7b4d1e6f3c",
      source_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

def binary_search(arr, target):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1

def main():
    data = [64, 34, 25, 12, 22, 11, 90]
    sorted_data = bubble_sort(data)
    print("Sorted:", sorted_data)
    idx = binary_search(sorted_data, 22)
    print("Found at index:", idx)`,
    },
    {
      submission_id: "9295e171-2a8d-4f7c-b3e6-5c9a1d4f8b2e",
      student_id: "9295e171-2a8d-4f7c-b3e6-5c9a1d4f8b2e",
      source_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

def binary_search(arr, target):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1

def main():
    data = [64, 34, 25, 12, 22, 11, 90]
    sorted_data = bubble_sort(data)
    print("Sorted array:", sorted_data)
    result = binary_search(sorted_data, 22)
    print("Element found at:", result)`,
    },
    {
      submission_id: "d262b9fb-9e3c-4a5d-8b1f-6d7c2e4a9b3f",
      student_id: "d262b9fb-9e3c-4a5d-8b1f-6d7c2e4a9b3f",
      source_code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

def binary_search(arr, target):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1

def main():
    numbers = [64, 34, 25, 12, 22, 11, 90]
    sorted_numbers = bubble_sort(numbers)
    print("Sorted:", sorted_numbers)
    index = binary_search(sorted_numbers, 22)
    print("Found at:", index)`,
    },
    // Cluster D (Type-3: structural similarity, different implementation)
    {
      submission_id: "11bf0f07-1c4e-4d6a-a8b3-7f5e9d2c1a8b",
      student_id: "11bf0f07-1c4e-4d6a-a8b3-7f5e9d2c1a8b",
      source_code: `def find_max(numbers):
    if not numbers:
        return None
    max_val = numbers[0]
    for num in numbers:
        if num > max_val:
            max_val = num
    return max_val

def find_min(numbers):
    if not numbers:
        return None
    min_val = numbers[0]
    for num in numbers:
        if num < min_val:
            min_val = num
    return min_val

def calculate_stats(data):
    total = sum(data)
    count = len(data)
    avg = total / count if count > 0 else 0
    maximum = find_max(data)
    minimum = find_min(data)
    return {
        "mean": avg,
        "max": maximum,
        "min": minimum,
        "range": maximum - minimum if maximum and minimum else 0
    }`,
    },
    {
      submission_id: "a4bfc312-8d6f-4c2e-b5a1-3e9d7c8f4b6a",
      student_id: "a4bfc312-8d6f-4c2e-b5a1-3e9d7c8f4b6a",
      source_code: `import statistics

def get_maximum(lst):
    return max(lst) if lst else None

def get_minimum(lst):
    return min(lst) if lst else None

def compute_statistics(dataset):
    if not dataset:
        return {"mean": 0, "max": None, "min": None, "range": 0}
    mean_val = statistics.mean(dataset)
    max_val = get_maximum(dataset)
    min_val = get_minimum(dataset)
    data_range = max_val - min_val if max_val is not None and min_val is not None else 0
    return {
        "mean": mean_val,
        "max": max_val,
        "min": min_val,
        "range": data_range
    }`,
    },
  ], []);

  // Set of dummy cluster group_ids for preloaded submission detection
  const dummyClusterIds = React.useMemo(
    () => new Set(dummySyntacticClusters.map((c) => c.group_id)),
    [dummySyntacticClusters]
  );

  // Filter and sort clusters
  const filteredClusters = React.useMemo(() => {
    if (!report) return [];

    let clusters = [...report.collusion_groups, ...dummySyntacticClusters];

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
  }, [report, searchQuery, thresholdFilter, sortBy, statusFilter, annotations, dummySyntacticClusters]);

  // Calculate summary stats
  const stats = React.useMemo(() => {
    if (!report) {
      return { highRisk: 0, mediumRisk: 0, lowRisk: 0, flaggedCases: 0 };
    }

    const allGroups = [...report.collusion_groups, ...dummySyntacticClusters];
    const highRisk = allGroups.filter((c) => c.max_confidence >= 0.85).length;
    const mediumRisk = allGroups.filter(
      (c) => c.max_confidence >= 0.75 && c.max_confidence < 0.85
    ).length;
    const lowRisk = allGroups.filter((c) => c.max_confidence < 0.75).length;

    // Count unique flagged students
    const flaggedStudents = new Set<string>();
    allGroups.forEach((group) => {
      group.member_ids.forEach((id) => flaggedStudents.add(id));
    });

    return { highRisk, mediumRisk, lowRisk, flaggedCases: flaggedStudents.size };
  }, [report, dummySyntacticClusters]);

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

      {/* Tabs: Syntactic vs Semantic */}
      <Tabs defaultValue="syntactic" className="w-full">
        <TabsList className="w-full max-w-2xl">
          <TabsTrigger value="syntactic" className="flex-1 gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Syntactic Analysis
          </TabsTrigger>
          <TabsTrigger value="semantic" className="flex-1 gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8Z"/><circle cx="12" cy="10" r="3"/></svg>
            Semantic Analysis
          </TabsTrigger>
          <TabsTrigger value="individual" className="flex-1 gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Individual Metrics
          </TabsTrigger>
        </TabsList>

        {/* ── Syntactic Analysis Tab ── */}
        <TabsContent value="syntactic" className="mt-6 space-y-6">

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

        </TabsContent>

        {/* ── Semantic Analysis Tab ── */}
        <TabsContent value="semantic" className="mt-6">
          <SemanticSimilaritySection
            assignmentId={assignmentId}
            instanceId={instanceId}
            isReportLoaded={!!report}
            onPairCompare={(comparison, cluster) => {
              setSemanticDiffComparison(comparison);
              setSemanticDiffCluster(cluster);
              setSemanticDiffOpen(true);
            }}
          />
        </TabsContent>

        {/* ── Individual Metrics Tab ── */}
        <TabsContent value="individual" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Individual Submission Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">Student</th>
                      <th className="p-3 text-left font-medium">AI Likelihood</th>
                      <th className="p-3 text-left font-medium">AI Generated</th>
                      <th className="p-3 text-left font-medium">Semantic Similarity</th>
                      <th className="p-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dummySubmissionMetrics.map((metrics) => (
                      <tr key={metrics.id} className="hover:bg-muted/30">
                        <td className="p-3">
                          <StudentAvatar studentId={metrics.id} size="sm" showName={true} />
                        </td>
                        <td className="p-3">
                          {metrics.aiLikelihood === null ? (
                            <span className="text-xs text-muted-foreground">Unavailable</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    metrics.aiLikelihood > 0.7
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
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              metrics.isAIGenerated
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            }`}
                          >
                            {metrics.isAIGenerated ? "Likely AI" : "Likely Human"}
                          </span>
                        </td>
                        <td className="p-3">
                          <SemanticSimilarityCompact
                            score={metrics.semanticSimilarity}
                          />
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-green-600 dark:text-green-400">✓ Stored</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
        preloadedSubmissions={
          diffSheetCluster && dummyClusterIds.has(diffSheetCluster.group_id)
            ? dummySubmissions.filter((s) =>
                diffSheetCluster.member_ids.includes(s.student_id)
              )
            : undefined
        }
      />

      {/* Semantic diff sheet — opens from semantic cluster pair comparison cards */}
      <SemanticDiffSheet
        comparison={semanticDiffComparison}
        cluster={semanticDiffCluster}
        open={semanticDiffOpen}
        onClose={() => setSemanticDiffOpen(false)}
      />
    </div>
  );
}
