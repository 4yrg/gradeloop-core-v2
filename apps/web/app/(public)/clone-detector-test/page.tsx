"use client";

import { useState, useEffect } from "react";
import {
  Users,
  GitCompare,
  ArrowRightLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ForceDirectedGraph } from "@/components/instructor/similarity/force-directed-graph";
import { DiffViewer } from "@/components/clone-detector/DiffViewer";
import type {
  CollusionGroup,
  CollusionEdge,
  StudentDetails,
  SegmentComparisonResult,
  MovedBlocksResult,
  SubmissionItem,
} from "@/types/cipas";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8106";

interface SampleCluster {
  cluster: CollusionGroup;
  student_details: Record<string, StudentDetails>;
}

export default function CloneDetectionTestPage() {
  const [activeTab, setActiveTab] = useState<"submissions" | "cluster" | "segments" | "moved">("submissions");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [clusterData, setClusterData] = useState<SampleCluster | null>(null);
  const [segmentData, setSegmentData] = useState<SegmentComparisonResult | null>(null);
  const [movedData, setMovedData] = useState<MovedBlocksResult | null>(null);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/syntactics/test/submissions`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching submissions");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCluster = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/syntactics/test/cluster`);
      if (!res.ok) throw new Error("Failed to fetch cluster");
      const data = await res.json();
      setClusterData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching cluster");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSegments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/syntactics/test/segment-comparison`);
      if (!res.ok) throw new Error("Failed to fetch segment comparison");
      const data = await res.json();
      setSegmentData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching segment comparison");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMovedBlocks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/syntactics/test/moved-blocks`);
      if (!res.ok) throw new Error("Failed to fetch moved blocks");
      const data = await res.json();
      setMovedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching moved blocks");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTab = async (tab: typeof activeTab) => {
    setActiveTab(tab);
    switch (tab) {
      case "submissions":
        return fetchSubmissions();
      case "cluster":
        return fetchCluster();
      case "segments":
        return fetchSegments();
      case "moved":
        return fetchMovedBlocks();
    }
  };

  useEffect(() => {
    loadTab("submissions");
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              Syntactic Clone Detection - UI Test Page
            </CardTitle>
            <CardDescription>
              Test the new UI implementations for cluster visualization, segment comparison, and moved block detection.
              Make sure the backend is running with CIPAS_LOCAL=true or APP_ENV=development.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Error Alert */}
        {error && (
          <Card className="border-red-500">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab Navigator */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === "submissions" ? "default" : "outline"}
            onClick={() => loadTab("submissions")}
          >
            Submissions
          </Button>
          <Button
            variant={activeTab === "cluster" ? "default" : "outline"}
            onClick={() => loadTab("cluster")}
          >
            Cluster Graph
          </Button>
          <Button
            variant={activeTab === "segments" ? "default" : "outline"}
            onClick={() => loadTab("segments")}
          >
            Segment Comparison
          </Button>
          <Button
            variant={activeTab === "moved" ? "default" : "outline"}
            onClick={() => loadTab("moved")}
          >
            Moved Blocks
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </CardContent>
          </Card>
        )}

        {/* Submissions Tab */}
        {!isLoading && activeTab === "submissions" && submissions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sample Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {submissions.map((sub) => (
                  <div
                    key={sub.submission_id}
                    className="p-4 rounded-lg border bg-zinc-50 dark:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="secondary">{sub.student_id}</Badge>
                        <span className="ml-2 font-medium">{sub.full_name}</span>
                        <span className="ml-2 text-sm text-zinc-500">
                          ({sub.student_number})
                        </span>
                      </div>
                      <code className="text-xs text-zinc-400">
                        {sub.source_code.split("\n").length} lines
                      </code>
                    </div>
                    <pre className="mt-2 text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-x-auto">
                      {sub.source_code.substring(0, 200)}...
                    </pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cluster Graph Tab */}
        {!isLoading && activeTab === "cluster" && clusterData && (
          <Card>
            <CardHeader>
              <CardTitle>Cluster Graph with Student Details</CardTitle>
              <CardDescription>
                Hover over nodes to see student details (name, student number, email)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ForceDirectedGraph
                  cluster={clusterData.cluster}
                  studentDetails={clusterData.student_details}
                  width={600}
                  height={400}
                />
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                <p className="font-medium">Cluster Details:</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Group ID:</span>{" "}
                    {clusterData.cluster.group_id}
                  </div>
                  <div>
                    <span className="text-zinc-500">Members:</span>{" "}
                    {clusterData.cluster.member_count}
                  </div>
                  <div>
                    <span className="text-zinc-500">Max Confidence:</span>{" "}
                    {(clusterData.cluster.max_confidence * 100).toFixed(0)}%
                  </div>
                  <div>
                    <span className="text-zinc-500">Clone Type:</span>{" "}
                    {clusterData.cluster.dominant_type}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Segment Comparison Tab */}
        {!isLoading && activeTab === "segments" && segmentData && (
          <Card>
            <CardHeader>
              <CardTitle>All-to-All Segment Comparison</CardTitle>
              <CardDescription>
                Comparing {segmentData.segment_count_a} segments vs{" "}
                {segmentData.segment_count_b} segments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Highest Confidence:</span>{" "}
                    {(segmentData.highest_confidence * 100).toFixed(0)}%
                  </div>
                  <div>
                    <span className="text-zinc-500">Dominant Type:</span>{" "}
                    {segmentData.dominant_clone_type}
                  </div>
                  <div>
                    <span className="text-zinc-500">Matched Pairs:</span>{" "}
                    {segmentData.matched_pairs.length}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="font-medium">Matched Segment Pairs:</p>
                  {segmentData.matched_pairs.map((pair, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          variant={
                            pair.clone_type === "Type-1"
                              ? "destructive"
                              : pair.clone_type === "Type-2"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {pair.clone_type}
                        </Badge>
                        <span className="text-sm font-mono">
                          {Math.round(pair.confidence * 100)}%
                        </span>
                        <span className="text-xs text-zinc-500">
                          Segment {pair.segment_index_a} ↔ {pair.segment_index_b}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-zinc-500 mb-1">Code A:</div>
                          <pre className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-x-auto">
                            {pair.segment_code_a}
                          </pre>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-1">Code B:</div>
                          <pre className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-x-auto">
                            {pair.segment_code_b}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Moved Blocks Tab */}
        {!isLoading && activeTab === "moved" && movedData && (
          <Card>
            <CardHeader>
              <CardTitle>Rearranged Code Detection</CardTitle>
              <CardDescription>
                Showing code blocks that appear in different positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {movedData.is_rearranged ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                  <span className="font-medium">
                    {movedData.is_rearranged
                      ? "Code was rearranged"
                      : "No rearrangement detected"}
                  </span>
                  <Badge variant="outline" className="ml-2">
                    {movedData.total_moved} moved blocks
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="font-medium">Moved Blocks:</p>
                  {movedData.moved_blocks.map((block, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{block.block_type}</Badge>
                        <span className="text-sm">
                          Position: {block.position_in_a} → {block.position_in_b}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {Math.round(block.similarity * 100)}% similar
                        </span>
                      </div>
                      <code className="text-sm">{block.code_snippet}</code>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}