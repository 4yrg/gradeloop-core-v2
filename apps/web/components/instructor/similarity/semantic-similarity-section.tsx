"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Brain,
  Eye,
  Info,
  GitCompare,
  Users,
  Layers,
  Sparkles,
  Code2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { StudentAvatar } from "./student-avatar";
import { getStudentName } from "@/lib/dummy-students";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface SemanticPairComparison {
  id: string;
  submissionA: { id: string; shortId: string; snippet: string };
  submissionB: { id: string; shortId: string; snippet: string };
  semanticScore: number; // 0–100, always ≥ 75
  matchedConcepts: string[];
  explanation: string;
}

export interface SemanticCluster {
  id: string;
  label: string;
  description: string;
  memberCount: number;
  members: { id: string; shortId: string }[];
  semanticScore: number; // 0–100, always ≥ 75
  category: "algorithmic" | "structural" | "logic-flow";
  explanation: string;
  codePattern: string;
  comparisons: SemanticPairComparison[];
}

interface SemanticSimilaritySectionProps {
  assignmentId: string;
  instanceId: string;
  isReportLoaded: boolean;
  className?: string;
  onPairCompare?: (comparison: SemanticPairComparison, cluster: SemanticCluster) => void;
}

// ──────────────────────────────────────────────────────────────────────────
// Dummy Pairwise Comparisons — all scores ≥ 75%
// ──────────────────────────────────────────────────────────────────────────

const CLUSTER_1_COMPARISONS: SemanticPairComparison[] = [
  {
    id: "cmp-1a",
    submissionA: {
      id: "sub-a1b2",
      shortId: "a1b2",
      snippet: `def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(l, r):
    result = []
    i = j = 0
    while i < len(l) and j < len(r):
        if l[i] <= r[j]:
            result.append(l[i])
            i += 1
        else:
            result.append(r[j])
            j += 1
    result.extend(l[i:])
    result.extend(r[j:])
    return result`,
    },
    submissionB: {
      id: "sub-c3d4",
      shortId: "c3d4",
      snippet: `def sort_array(data):
    if len(data) < 2:
        return data
    pivot = len(data) // 2
    first_half = sort_array(data[:pivot])
    second_half = sort_array(data[pivot:])
    return combine(first_half, second_half)

def combine(a, b):
    merged = []
    x = y = 0
    while x < len(a) and y < len(b):
        if a[x] <= b[y]:
            merged.append(a[x])
            x += 1
        else:
            merged.append(b[y])
            y += 1
    merged.extend(a[x:])
    merged.extend(b[y:])
    return merged`,
    },
    semanticScore: 96,
    matchedConcepts: ["Divide & Conquer", "Recursive split", "Two-pointer merge", "Stable sort"],
    explanation:
      "Both submissions implement merge sort with identical algorithmic structure. The only differences are variable names (arr→data, l/r→a/b, merge→combine). The recursion base case, split point, and merge logic are functionally identical.",
  },
  {
    id: "cmp-1b",
    submissionA: {
      id: "sub-e5f6",
      shortId: "e5f6",
      snippet: `def my_sort(numbers):
    if len(numbers) <= 1:
        return numbers
    center = len(numbers) // 2
    left_part = my_sort(numbers[:center])
    right_part = my_sort(numbers[center:])
    return join_sorted(left_part, right_part)

def join_sorted(p, q):
    output = []
    while p and q:
        if p[0] <= q[0]:
            output.append(p.pop(0))
        else:
            output.append(q.pop(0))
    return output + p + q`,
    },
    submissionB: {
      id: "sub-g7h8",
      shortId: "g7h8",
      snippet: `def recursive_sort(lst):
    if len(lst) < 2:
        return lst
    half = len(lst) // 2
    lower = recursive_sort(lst[:half])
    upper = recursive_sort(lst[half:])
    return interleave(lower, upper)

def interleave(s1, s2):
    res = []
    while s1 and s2:
        if s1[0] <= s2[0]:
            res.append(s1.pop(0))
        else:
            res.append(s2.pop(0))
    return res + s1 + s2`,
    },
    semanticScore: 94,
    matchedConcepts: ["Merge sort", "List pop merge", "Recursive decomposition"],
    explanation:
      "Same merge sort algorithm, same pop-based merge strategy. Both use list.pop(0) in the merge step instead of index tracking — an unusual but identical approach suggesting a common source.",
  },
];

const CLUSTER_2_COMPARISONS: SemanticPairComparison[] = [
  {
    id: "cmp-2a",
    submissionA: {
      id: "sub-k1l2",
      shortId: "k1l2",
      snippet: `class DataProcessor:
    def __init__(self, data):
        self.data = data
        self.validated = False

    def validate(self):
        if not self.data:
            raise ValueError("Empty data")
        self.validated = True
        return self

    def transform(self):
        if not self.validated:
            self.validate()
        return [self._process(item) for item in self.data]

    def _process(self, item):
        return item.strip().lower()`,
    },
    submissionB: {
      id: "sub-m3n4",
      shortId: "m3n4",
      snippet: `class InputHandler:
    def __init__(self, raw_input):
        self.raw_input = raw_input
        self.is_valid = False

    def check_valid(self):
        if not self.raw_input:
            raise ValueError("No input")
        self.is_valid = True
        return self

    def process_all(self):
        if not self.is_valid:
            self.check_valid()
        return [self._clean(entry) for entry in self.raw_input]

    def _clean(self, entry):
        return entry.strip().lower()`,
    },
    semanticScore: 91,
    matchedConcepts: ["Class-based pipeline", "Lazy validation", "Method chaining", "List comprehension transform"],
    explanation:
      "Identical 3-method class structure: constructor → validate → transform. Both use lazy validation (auto-validate if not done), list comprehension processing, and the same strip().lower() cleanup. Class/method names differ but architecture is a 1:1 match.",
  },
];

const CLUSTER_3_COMPARISONS: SemanticPairComparison[] = [
  {
    id: "cmp-3a",
    submissionA: {
      id: "sub-q7r8",
      shortId: "q7r8",
      snippet: `def find_path(graph, start, end, visited=None):
    if visited is None:
        visited = set()
    if start == end:
        return [start]
    visited.add(start)
    for neighbor in graph.get(start, []):
        if neighbor not in visited:
            path = find_path(graph, neighbor, end, visited)
            if path:
                return [start] + path
    return None`,
    },
    submissionB: {
      id: "sub-s9t0",
      shortId: "s9t0",
      snippet: `def search_route(adj_list, source, dest, seen=None):
    if seen is None:
        seen = set()
    if source == dest:
        return [source]
    seen.add(source)
    for next_node in adj_list.get(source, []):
        if next_node not in seen:
            route = search_route(adj_list, next_node, dest, seen)
            if route:
                return [source] + route
    return None`,
    },
    semanticScore: 97,
    matchedConcepts: ["DFS path finding", "Recursive backtracking", "Visited set", "Adjacency list traversal"],
    explanation:
      "Near-perfect semantic match — both implement recursive DFS path finding with visited-set cycle prevention. Identical base case, recursion structure, and path construction via concatenation. Only variable/function names differ.",
  },
  {
    id: "cmp-3b",
    submissionA: {
      id: "sub-u1v2",
      shortId: "u1v2",
      snippet: `def traverse(connections, origin, target, explored=None):
    if explored is None:
        explored = set()
    if origin == target:
        return [origin]
    explored.add(origin)
    for adj in connections.get(origin, []):
        if adj not in explored:
            result = traverse(connections, adj, target, explored)
            if result is not None:
                return [origin] + result
    return None`,
    },
    submissionB: {
      id: "sub-w3x4",
      shortId: "w3x4",
      snippet: `def dfs_find(graph_map, node, goal, visited=None):
    if visited is None:
        visited = set()
    if node == goal:
        return [node]
    visited.add(node)
    for nbr in graph_map.get(node, []):
        if nbr not in visited:
            found = dfs_find(graph_map, nbr, goal, visited)
            if found:
                return [node] + found
    return None`,
    },
    semanticScore: 95,
    matchedConcepts: ["DFS", "Recursive search", "Cycle detection", "Path accumulation"],
    explanation:
      "All four submissions in this cluster implement the exact same DFS algorithm. This pair also follows the identical pattern — default mutable argument guard, set-based visited tracking, recursive neighbor exploration, and path list construction.",
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Dummy Clusters — always shown, all scores ≥ 75%
// ──────────────────────────────────────────────────────────────────────────

const DUMMY_SEMANTIC_CLUSTERS: SemanticCluster[] = [
  {
    id: "sem-1",
    label: "Algorithmic Equivalence",
    description: "Submissions using semantically identical algorithms with different variable names and formatting",
    memberCount: 5,
    members: [
      { id: "sub-a1b2", shortId: "a1b2" },
      { id: "sub-c3d4", shortId: "c3d4" },
      { id: "sub-e5f6", shortId: "e5f6" },
      { id: "sub-g7h8", shortId: "g7h8" },
      { id: "sub-i9j0", shortId: "i9j0" },
    ],
    semanticScore: 94,
    category: "algorithmic",
    explanation:
      "These submissions implement the same sorting algorithm (merge sort) with identical logic flow. Variable names and comments differ, but the underlying computational approach is identical — suggesting shared source material or collaboration.",
    codePattern: "Merge Sort → Divide & Conquer → O(n log n)",
    comparisons: CLUSTER_1_COMPARISONS,
  },
  {
    id: "sem-2",
    label: "Structural Mirroring",
    description: "Near-identical code structure with superficial refactoring (renamed functions, reordered blocks)",
    memberCount: 3,
    members: [
      { id: "sub-k1l2", shortId: "k1l2" },
      { id: "sub-m3n4", shortId: "m3n4" },
      { id: "sub-o5p6", shortId: "o5p6" },
    ],
    semanticScore: 87,
    category: "structural",
    explanation:
      "Code structure is mirrored across submissions — same function decomposition, same helper methods, same error handling patterns. Only surface-level changes like function renaming and whitespace differences detected.",
    codePattern: "3-layer structure → Helper utils → Error handler",
    comparisons: CLUSTER_2_COMPARISONS,
  },
  {
    id: "sem-3",
    label: "Logic Flow Similarity",
    description: "Shared control flow patterns and decision logic despite different implementations",
    memberCount: 4,
    members: [
      { id: "sub-q7r8", shortId: "q7r8" },
      { id: "sub-s9t0", shortId: "s9t0" },
      { id: "sub-u1v2", shortId: "u1v2" },
      { id: "sub-w3x4", shortId: "w3x4" },
    ],
    semanticScore: 82,
    category: "logic-flow",
    explanation:
      "These submissions share remarkably similar control flow — identical branching conditions, loop structures, and exit points. While variable names and some expressions differ, the decision-making logic is highly correlated.",
    codePattern: "DFS path finding → Recursive backtracking → Visited set",
    comparisons: CLUSTER_3_COMPARISONS,
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: SemanticCluster["category"] }) {
  const config: Record<
    SemanticCluster["category"],
    { label: string; className: string }
  > = {
    algorithmic: {
      label: "Algorithmic",
      className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    },
    structural: {
      label: "Structural",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    "logic-flow": {
      label: "Logic Flow",
      className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    },
  };

  const c = config[category];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}

function ScoreRing({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const radius = size === "sm" ? 16 : 20;
  const viewBox = size === "sm" ? "0 0 40 40" : "0 0 48 48";
  const cx = size === "sm" ? 20 : 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 90
      ? "stroke-red-500"
      : score >= 80
        ? "stroke-orange-500"
        : "stroke-amber-500";

  return (
    <div className={cn("relative flex-shrink-0", size === "sm" ? "w-10 h-10" : "w-14 h-14")}>
      <svg className="w-full h-full -rotate-90" viewBox={viewBox}>
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          className="stroke-muted/30"
          strokeWidth={size === "sm" ? 3 : 4}
        />
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          className={cn(color, "transition-all duration-700")}
          strokeWidth={size === "sm" ? 3 : 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("font-black tabular-nums", size === "sm" ? "text-[10px]" : "text-xs")}>
          {score}%
        </span>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
      : score >= 80
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold tabular-nums", color)}>
      {score}% match
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Pairwise Comparison Card — side-by-side code with semantic score
// ──────────────────────────────────────────────────────────────────────────

function PairComparisonCard({ comparison, onCompare }: { comparison: SemanticPairComparison; onCompare?: () => void }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Comparison Header */}
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <StudentAvatar studentId={comparison.submissionA.id} size="xs" showName={true} />
            <GitCompare className="h-3 w-3 text-muted-foreground" />
            <StudentAvatar studentId={comparison.submissionB.id} size="xs" showName={true} />
          </div>
          <ScoreBadge score={comparison.semanticScore} />
          <div className="flex gap-1 flex-wrap">
            {comparison.matchedConcepts.slice(0, 3).map((concept) => (
              <span
                key={concept}
                className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 font-medium"
              >
                {concept}
              </span>
            ))}
            {comparison.matchedConcepts.length > 3 && (
              <span className="text-[9px] text-muted-foreground">
                +{comparison.matchedConcepts.length - 3} more
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Expanded: side-by-side code + explanation */}
      {expanded && (
        <div className="border-t">
          {/* Code comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
            {/* Submission A */}
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
                <Code2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {getStudentName(comparison.submissionA.id)}
                </span>
              </div>
              <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto font-mono text-foreground/90 max-h-[300px] overflow-y-auto">
                <code>{comparison.submissionA.snippet}</code>
              </pre>
            </div>

            {/* Submission B */}
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
                <Code2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {getStudentName(comparison.submissionB.id)}
                </span>
              </div>
              <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto font-mono text-foreground/90 max-h-[300px] overflow-y-auto">
                <code>{comparison.submissionB.snippet}</code>
              </pre>
            </div>
          </div>

          {/* Explanation + Compare action */}
          <div className="border-t px-4 py-3 bg-muted/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1">
                <Brain className="h-3.5 w-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {comparison.explanation}
                </p>
              </div>
              {onCompare && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 gap-1.5 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompare();
                  }}
                >
                  <Eye className="h-3 w-3" />
                  Open Diff
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Cluster Card — with embedded pairwise comparisons
// ──────────────────────────────────────────────────────────────────────────

function SemanticClusterCard({
  cluster,
  onPairCompare,
}: {
  cluster: SemanticCluster;
  onPairCompare?: (comparison: SemanticPairComparison, cluster: SemanticCluster) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const riskLevel =
    cluster.semanticScore >= 90
      ? "Critical"
      : cluster.semanticScore >= 80
        ? "High"
        : "Elevated";

  const riskColor =
    cluster.semanticScore >= 90
      ? "text-red-600 dark:text-red-400"
      : cluster.semanticScore >= 80
        ? "text-orange-600 dark:text-orange-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        expanded && "ring-1 ring-primary/20"
      )}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-4">
          <ScoreRing score={cluster.semanticScore} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-bold">{cluster.label}</h4>
              <CategoryBadge category={cluster.category} />
              <span className={cn("text-[10px] font-bold uppercase", riskColor)}>
                {riskLevel}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              {cluster.description}
            </p>

            {/* Members row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground font-medium">
                {cluster.memberCount} submissions
              </span>
              <span className="text-muted-foreground">·</span>
              <div className="flex -space-x-1.5">
                {cluster.members.slice(0, 4).map((m) => (
                  <StudentAvatar key={m.id} studentId={m.id} size="xs" showName={false} />
                ))}
                {cluster.memberCount > 4 && (
                  <div className="w-5 h-5 rounded-full bg-muted border border-white dark:border-slate-900 flex items-center justify-center">
                    <span className="text-[8px] font-bold">
                      +{cluster.memberCount - 4}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {cluster.comparisons.length} pair{cluster.comparisons.length !== 1 ? "s" : ""} compared
              </span>
              <span className="text-muted-foreground">·</span>
              <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                {cluster.codePattern}
              </code>
            </div>
          </div>

          {/* Action */}
          <Button
            size="sm"
            variant={expanded ? "secondary" : "ghost"}
            className="flex-shrink-0 gap-1.5"
            onClick={() => setExpanded(!expanded)}
          >
            <Eye className="h-3 w-3" />
            {expanded ? "Collapse" : "Compare"}
          </Button>
        </div>

        {/* Expanded: cluster explanation + pairwise comparisons */}
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Cluster-level explanation */}
            <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
              <Brain className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold mb-1">Cluster Semantic Analysis</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {cluster.explanation}
                </p>
              </div>
            </div>

            {/* Pairwise comparisons */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <GitCompare className="h-3.5 w-3.5" />
                Pairwise Submission Comparisons
              </p>
              {cluster.comparisons.map((cmp) => (
                <PairComparisonCard
                  key={cmp.id}
                  comparison={cmp}
                  onCompare={onPairCompare ? () => onPairCompare(cmp, cluster) : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────

export function SemanticSimilaritySection({
  assignmentId,
  instanceId,
  isReportLoaded,
  className,
  onPairCompare,
}: SemanticSimilaritySectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Card — explains semantic similarity */}
      <Card className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20 border-violet-200/50 dark:border-violet-800/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-900/40">
              <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            Semantic Similarity Analysis
            <Badge
              variant="secondary"
              className="ml-2 text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
            >
              Beta
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Semantic similarity goes beyond syntactic (text-based) clone detection. It analyzes
            the <strong>meaning and intent</strong> of code — identifying submissions that solve
            problems in functionally identical ways even when the code looks different on the surface.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/40">
              <Layers className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold">Code Embeddings</p>
                <p className="text-[11px] text-muted-foreground">
                  Converts code into vector representations capturing algorithmic intent
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/40">
              <GitCompare className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold">Pairwise Comparison</p>
                <p className="text-[11px] text-muted-foreground">
                  Compares every submission pair using cosine similarity on embeddings
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/40">
              <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold">Cluster Formation</p>
                <p className="text-[11px] text-muted-foreground">
                  Groups semantically similar submissions into clusters for review
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3 flex-shrink-0" />
            <span>
              Semantic analysis complements syntactic detection — it catches refactored code,
              algorithm-level plagiarism, and AI-generated solutions that share underlying logic.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Semantic Clusters with Comparisons */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-500" />
              Semantic Clusters
              <span className="text-xs font-normal text-muted-foreground">
                ({DUMMY_SEMANTIC_CLUSTERS.length} groups • {DUMMY_SEMANTIC_CLUSTERS.reduce((n, c) => n + c.comparisons.length, 0)} comparisons)
              </span>
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" disabled>
                    <Sparkles className="h-3 w-3" />
                    Re-analyze
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Backend integration coming soon</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {DUMMY_SEMANTIC_CLUSTERS.map((cluster) => (
            <SemanticClusterCard key={cluster.id} cluster={cluster} onPairCompare={onPairCompare} />
          ))}
        </CardContent>
      </Card>

      {/* How it works footer */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                How Semantic Similarity Differs from Syntactic Detection
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong>Syntactic detection</strong> finds code that looks similar at the text
                level — shared lines, renamed variables, and copy-paste patterns.{" "}
                <strong>Semantic analysis</strong> understands what the code <em>does</em>, finding
                submissions that implement the same algorithm or logic even when written completely
                differently. Together, they provide comprehensive plagiarism detection coverage.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
