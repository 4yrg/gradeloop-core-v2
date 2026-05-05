"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SegmentSimilarityGraphView } from "./segment-similarity-graph-view";
import { TOP_HILL_SUBMISSIONS } from "@/data/top-hill-segments";
import {
  aiStyleExplanation,
  buildSegmentGraph,
  egoNetwork,
  explainMetricsForPair,
  humanCloneReason,
} from "@/lib/similarity-segment-graph/graph-engine";
import type { SegmentEdgeModel, SegmentNodeModel } from "@/lib/similarity-segment-graph/types";
import { SectionHeader } from "@/components/instructor/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Network, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopHillSegmentNetworkDashboard() {
  const graph = React.useMemo(() => buildSegmentGraph(TOP_HILL_SUBMISSIONS), []);
  const submissionOrder = React.useMemo(
    () => TOP_HILL_SUBMISSIONS.map((s) => s.submission_id),
    [],
  );

  const segmentNodeById = React.useMemo(() => {
    const m = new Map<string, SegmentNodeModel>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph.nodes]);

  const [layoutMode, setLayoutMode] = React.useState<"force" | "hierarchical">("force");
  const [cloneT1, setCloneT1] = React.useState(true);
  const [cloneT2, setCloneT2] = React.useState(true);
  const [cloneT3, setCloneT3] = React.useState(true);
  const [threshold, setThreshold] = React.useState(0.55);
  const [studentFilter, setStudentFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [selectedSegments, setSelectedSegments] = React.useState<Set<string>>(new Set());
  const [hoveredSegmentId, setHoveredSegmentId] = React.useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = React.useState<SegmentEdgeModel | null>(null);
  const [focusSubgraph, setFocusSubgraph] = React.useState(false);
  const [replayActive, setReplayActive] = React.useState(false);
  const [replayMax, setReplayMax] = React.useState<number | null>(null);
  const graphWrapRef = React.useRef<HTMLDivElement>(null);

  const filteredEdges = React.useMemo(() => {
    const types = new Set<1 | 2 | 3>();
    if (cloneT1) types.add(1);
    if (cloneT2) types.add(2);
    if (cloneT3) types.add(3);
    return graph.edges.filter(
      (e) => types.has(e.clone_type) && e.confidence >= threshold,
    );
  }, [graph.edges, cloneT1, cloneT2, cloneT3, threshold]);

  const searchNorm = search.trim().toLowerCase();
  const visibleNodes = React.useMemo(() => {
    return graph.nodes.filter((n) => {
      const prof = graph.profilesBySubmission.get(n.submission_id)!;
      if (searchNorm) {
        const hitSeg = n.segment_id.toLowerCase().includes(searchNorm);
        const hitName = prof.name.toLowerCase().includes(searchNorm);
        if (!hitSeg && !hitName) return false;
      }
      if (studentFilter !== "all" && n.student_id !== studentFilter) return false;
      return true;
    });
  }, [graph.nodes, graph.profilesBySubmission, searchNorm, studentFilter]);

  const visibleIds = React.useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const displayEdges = React.useMemo(() => {
    let e = filteredEdges.filter((x) => visibleIds.has(x.source_id) && visibleIds.has(x.target_id));
    if (focusSubgraph && selectedSegments.size > 0) {
      const sub = egoNetwork(selectedSegments, e, 2);
      e = e.filter((ed) => sub.has(ed.source_id) && sub.has(ed.target_id));
    }
    return e;
  }, [filteredEdges, visibleIds, focusSubgraph, selectedSegments]);

  const highlightedSegmentIds = React.useMemo(() => {
    const out = new Set<string>();
    if (selectedEdge) {
      out.add(selectedEdge.source_id);
      out.add(selectedEdge.target_id);
      for (const e of displayEdges) {
        if (e.source_id === selectedEdge.source_id || e.target_id === selectedEdge.source_id)
          out.add(e.source_id === selectedEdge.source_id ? e.target_id : e.source_id);
        if (e.source_id === selectedEdge.target_id || e.target_id === selectedEdge.target_id)
          out.add(e.source_id === selectedEdge.target_id ? e.target_id : e.source_id);
      }
      return out;
    }
    const primary = [...selectedSegments][selectedSegments.size - 1];
    if (primary) {
      const n = segmentNodeById.get(primary);
      if (n) {
        for (const x of graph.nodes) {
          if (x.student_id === n.student_id) out.add(x.id);
        }
        const ego = egoNetwork(new Set([primary]), displayEdges, 2);
        ego.forEach((id) => out.add(id));
      }
    }
    return out;
  }, [
    selectedEdge,
    selectedSegments,
    displayEdges,
    graph.nodes,
    segmentNodeById,
  ]);

  React.useEffect(() => {
    if (!replayActive) return;
    let step = 4;
    const total = Math.max(filteredEdges.length, 1);
    setReplayMax(step);
    const id = window.setInterval(() => {
      step += 6;
      if (step >= total) {
        setReplayMax(null);
        setReplayActive(false);
        window.clearInterval(id);
        return;
      }
      setReplayMax(step);
    }, 130);
    return () => window.clearInterval(id);
  }, [replayActive, filteredEdges.length]);

  const handleNodeClick = (id: string, multi: boolean) => {
    setSelectedEdge(null);
    setSelectedSegments((prev) => {
      if (!multi) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const profileForPanel = React.useMemo(() => {
    const segId = hoveredSegmentId ?? [...selectedSegments][selectedSegments.size - 1];
    if (!segId) return null;
    const n = segmentNodeById.get(segId);
    if (!n) return null;
    return graph.profilesBySubmission.get(n.submission_id) ?? null;
  }, [hoveredSegmentId, selectedSegments, segmentNodeById, graph.profilesBySubmission]);

  const risk = profileForPanel
    ? graph.studentRisk.get(profileForPanel.student_id)
    : null;

  const explainPair = React.useMemo(() => {
    if (!selectedEdge) return null;
    const a = segmentNodeById.get(selectedEdge.source_id);
    const b = segmentNodeById.get(selectedEdge.target_id);
    if (!a || !b) return null;
    const metrics =
      graph.explainCache.get(selectedEdge.id) ??
      explainMetricsForPair(a.code, b.code, selectedEdge.clone_type);
    return { a, b, metrics, t: selectedEdge.clone_type };
  }, [selectedEdge, segmentNodeById, graph.explainCache]);

  const timelineRows = React.useMemo(() => {
    const subs = [...TOP_HILL_SUBMISSIONS].sort(
      (x, y) =>
        (graph.profilesBySubmission.get(x.submission_id)?.submitted_at ?? "").localeCompare(
          graph.profilesBySubmission.get(y.submission_id)?.submitted_at ?? "",
        ),
    );
    let cum = 0;
    return subs.map((s, idx) => {
      const related = filteredEdges.filter((e) => {
        const sa = segmentNodeById.get(e.source_id)!.submission_id;
        const sb = segmentNodeById.get(e.target_id)!.submission_id;
        const set = new Set([sa, sb]);
        return set.has(s.submission_id);
      }).length;
      cum += related;
      return {
        idx: idx + 1,
        label: s.submission_id,
        edges: related,
        cumulative: cum,
      };
    });
  }, [filteredEdges, graph.profilesBySubmission, segmentNodeById]);

  const exportSvg = () => {
    const svg = graphWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([clone.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `top-hill-segment-graph-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueStudents = React.useMemo(() => {
    return [...new Set(graph.nodes.map((n) => n.student_id))].sort();
  }, [graph.nodes]);

  const replayEdgeCount = replayActive ? replayMax : null;

  const hoverSnippet =
    hoveredSegmentId && segmentNodeById.get(hoveredSegmentId)?.code;

  return (
    <div className="flex flex-col gap-6 p-6 pb-16 max-w-[1800px] mx-auto">
      <SectionHeader
        title="Top Hill — segment similarity network"
        description="Twenty Java submissions at segment granularity: clone Type 1 / 2 / 3 edges, community layout, and explainable similarity signals (demo dataset)."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Network className="h-4 w-4" />
                Filters & layout
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Layout</Label>
                  <Select
                    value={layoutMode}
                    onValueChange={(v) => setLayoutMode(v as "force" | "hierarchical")}
                  >
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="force">Force-directed</SelectItem>
                      <SelectItem value="hierarchical">Hierarchical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={cloneT1} onCheckedChange={setCloneT1} />
                    Type 1
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={cloneT2} onCheckedChange={setCloneT2} />
                    Type 2
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={cloneT3} onCheckedChange={setCloneT3} />
                    Type 3
                  </label>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Switch checked={focusSubgraph} onCheckedChange={setFocusSubgraph} />
                  Focus multi-select subgraph
                </div>
              </div>
              <div className="space-y-1 max-w-md">
                <Label className="text-xs">
                  Min. confidence: {threshold.toFixed(2)}
                </Label>
                <Slider
                  value={[Math.round(threshold * 100)]}
                  min={50}
                  max={99}
                  step={1}
                  onValueChange={(v) => setThreshold(Math.max(0.5, Math.min(0.99, (v[0] ?? 55) / 100)))}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Student</Label>
                  <Select value={studentFilter} onValueChange={setStudentFilter}>
                    <SelectTrigger className="w-[200px] h-9">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All students</SelectItem>
                      {uniqueStudents.map((sid) => (
                        <SelectItem key={sid} value={sid}>
                          {graph.profilesByStudent.get(sid)?.name ?? sid}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs">Search (name / segment id)</Label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="e.g. S12_B or Student 5"
                    className="h-9"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <Button type="button" variant="outline" size="sm" onClick={exportSvg}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export SVG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReplayActive((v) => !v)}
                  >
                    {replayActive ? (
                      <Square className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1" />
                    )}
                    Replay edges
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <SegmentSimilarityGraphView
              ref={graphWrapRef}
              nodes={visibleNodes}
              edges={displayEdges}
              layoutMode={layoutMode}
              submissionOrder={submissionOrder}
              selectedSegmentIds={selectedSegments}
              highlightedSegmentIds={highlightedSegmentIds}
              hoveredSegmentId={hoveredSegmentId}
              selectedEdgeId={selectedEdge?.id ?? null}
              replayEdgeCount={replayEdgeCount}
              onNodeClick={handleNodeClick}
              onNodeHover={setHoveredSegmentId}
              onEdgeClick={(e) => {
                setSelectedSegments(new Set());
                setSelectedEdge(e);
              }}
              onBackgroundClick={() => {
                setSelectedSegments(new Set());
                setSelectedEdge(null);
              }}
            />

          {hoverSnippet && (
            <Card className="border-dashed">
              <CardHeader className="py-2">
                <CardTitle className="text-xs font-normal text-muted-foreground">
                  Hover preview — {hoveredSegmentId}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 p-3 rounded-md">
                  {hoverSnippet}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Submission clusters (connectivity)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {graph.submissionClusters.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "flex flex-wrap items-center gap-2 text-xs border rounded-md px-2 py-1.5",
                    c.suspicion === "high" && "border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30",
                    c.suspicion === "medium" && "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
                  )}
                >
                  <Badge variant="outline">#{c.id + 1}</Badge>
                  <span className="text-muted-foreground">
                    {c.submission_ids.join(", ")}
                  </span>
                  <Badge
                    variant={
                      c.suspicion === "high"
                        ? "destructive"
                        : c.suspicion === "medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {c.suspicion} suspicion
                  </Badge>
                  <span className="ml-auto opacity-70">{c.cross_edge_count} internal cross-edges</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Timeline — similarity emergence</CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineRows}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="cumulative" stroke="#6366f1" dot={false} name="Cumulative edges" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Student profile</CardTitle>
            </CardHeader>
            <CardContent>
              {profileForPanel ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {profileForPanel.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{profileForPanel.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {profileForPanel.student_id} · {profileForPanel.submission_id}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Submitted {format(new Date(profileForPanel.submitted_at), "PPp")}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">
                      Past flags: {profileForPanel.past_similarity_flags}
                    </Badge>
                    {risk && (
                      <Badge variant={risk.label === "High" ? "destructive" : "secondary"}>
                        Risk: {risk.label} ({risk.score})
                      </Badge>
                    )}
                  </div>
                  <Separator />
                  <div className="text-xs">
                    <span className="text-muted-foreground">Community suspicion (segment graph): </span>
                    {(() => {
                      const sid =
                        hoveredSegmentId ?? [...selectedSegments][selectedSegments.size - 1];
                      if (!sid) return "—";
                      const com = segmentNodeById.get(sid)?.community_id;
                      if (com == null) return "—";
                      const s = graph.communitySuspicion.get(com);
                      return s ? `${s.label} (${s.level})` : "Low";
                    })()}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Hover or select a segment to see profile and risk context.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Explainable similarity</CardTitle>
            </CardHeader>
            <CardContent>
              {explainPair ? (
                <ScrollArea className="h-[420px] pr-3">
                  <div className="space-y-3 text-xs">
                    <Badge
                      className={cn(
                        explainPair.t === 1 && "bg-[#22c55e] hover:bg-[#22c55e]",
                        explainPair.t === 2 && "bg-[#3b82f6] hover:bg-[#3b82f6]",
                        explainPair.t === 3 && "bg-[#f97316] hover:bg-[#f97316]",
                      )}
                    >
                      Type {explainPair.t}
                    </Badge>
                    <p>{humanCloneReason(explainPair.t)}</p>
                    <p className="text-muted-foreground italic">
                      {aiStyleExplanation(explainPair.a.code, explainPair.b.code, explainPair.t)}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Token</div>
                        <div className="font-semibold">{explainPair.metrics.token_similarity_pct}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">AST</div>
                        <div className="font-semibold">{explainPair.metrics.ast_similarity_pct}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Control flow</div>
                        <div className="font-semibold">{explainPair.metrics.control_flow_similarity_pct}%</div>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-1">{explainPair.a.segment_id}</div>
                        <pre className="font-mono bg-muted/60 p-2 rounded-md whitespace-pre-wrap break-all">
                          {explainPair.a.code}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground mb-1">{explainPair.b.segment_id}</div>
                        <pre className="font-mono bg-muted/60 p-2 rounded-md whitespace-pre-wrap break-all">
                          {explainPair.b.code}
                        </pre>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Select an edge to compare segments side-by-side with heuristic similarity metrics and an
                  explanation template (wire to CIPAS XAI for live LLM text).
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
