"use client";

import React, { useEffect, useRef, useCallback, forwardRef } from "react";
import * as d3 from "d3";
import type { SegmentEdgeModel, SegmentNodeModel } from "@/lib/similarity-segment-graph/types";
import { cn } from "@/lib/utils";

const EDGE_STROKE: Record<1 | 2 | 3, string> = {
  1: "#22c55e",
  2: "#3b82f6",
  3: "#f97316",
};

const SUBMISSION_FILL = d3.schemeTableau10 ?? d3.schemeCategory10;

export interface SegmentSimilarityGraphViewProps {
  nodes: SegmentNodeModel[];
  edges: SegmentEdgeModel[];
  layoutMode: "force" | "hierarchical";
  submissionOrder: string[];
  selectedSegmentIds: Set<string>;
  highlightedSegmentIds: Set<string>;
  hoveredSegmentId: string | null;
  selectedEdgeId: string | null;
  replayEdgeCount: number | null;
  className?: string;
  onNodeClick: (segmentId: string, multi: boolean) => void;
  onNodeHover: (segmentId: string | null) => void;
  onEdgeClick: (edge: SegmentEdgeModel) => void;
  onBackgroundClick: () => void;
}

export const SegmentSimilarityGraphView = forwardRef<
  HTMLDivElement,
  SegmentSimilarityGraphViewProps
>(function SegmentSimilarityGraphView({
  nodes,
  edges,
  layoutMode,
  submissionOrder,
  selectedSegmentIds,
  highlightedSegmentIds,
  hoveredSegmentId,
  selectedEdgeId,
  replayEdgeCount,
  className,
  onNodeClick,
  onNodeHover,
  onEdgeClick,
  onBackgroundClick,
}: SegmentSimilarityGraphViewProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<SegmentNodeModel, undefined> | null>(null);

  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  });

  const build = useCallback(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!svgEl || !container || nodes.length === 0) return;

    simRef.current?.stop();
    simRef.current = null;

    const width = container.clientWidth || 960;
    const height = 560;

    const margin = { top: 24, right: 24, bottom: 24, left: 24 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const visibleEdges =
      replayEdgeCount != null ? edges.slice(0, replayEdgeCount) : edges;

    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n } as SegmentNodeModel]));
    const simNodes = Array.from(nodeMap.values());

    const subIndex = new Map(submissionOrder.map((s, i) => [s, i]));

    const perSub = new Map<string, SegmentNodeModel[]>();
    for (const n of simNodes) {
      if (!perSub.has(n.submission_id)) perSub.set(n.submission_id, []);
      perSub.get(n.submission_id)!.push(n);
    }
    for (const [, arr] of perSub) {
      arr.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
    }

    if (layoutMode === "hierarchical") {
      const cols = Math.max(1, submissionOrder.length);
      const colW = innerW / Math.min(cols, 10);
      simNodes.forEach((n) => {
        const si = subIndex.get(n.submission_id) ?? 0;
        const list = perSub.get(n.submission_id) || [];
        const j = list.indexOf(n);
        const rowGap = 70;
        n.x = margin.left + (si % 10) * colW + colW / 2 + (n.community_id % 3) * 8;
        n.y = margin.top + j * rowGap + 40 + (n.community_id % 4) * 6;
      });
    } else {
      simNodes.forEach((n) => {
        n.fx = undefined;
        n.fy = undefined;
        if (n.x == null) n.x = width / 2 + (Math.random() - 0.5) * 40;
        if (n.y == null) n.y = height / 2 + (Math.random() - 0.5) * 40;
      });
    }

    const links = visibleEdges
      .map((e) => ({
        source: simNodes.find((n) => n.id === e.source_id)!,
        target: simNodes.find((n) => n.id === e.target_id)!,
        edge: e,
      }))
      .filter((l) => l.source && l.target);

    d3.select(svgEl).selectAll("*").remove();

    const svg = d3
      .select(svgEl)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("class", "touch-none select-none");

    const gRoot = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 5])
      .on("zoom", (ev) => gRoot.attr("transform", ev.transform));
    svg.call(zoom);
    svg.on("dblclick.zoom", () =>
      svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity),
    );

    const g = gRoot.append("g");

    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .on("click", () => onBackgroundClick());

    const linkSel = g
      .append("g")
      .attr("fill", "none")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => EDGE_STROKE[d.edge.clone_type])
      .attr("stroke-opacity", (d) =>
        selectedEdgeId && d.edge.id === selectedEdgeId ? 1 : 0.38,
      )
      .attr("stroke-width", (d) => 1.2 + d.edge.confidence * 5)
      .style("cursor", "pointer")
      .on("click", (ev, d) => {
        ev.stopPropagation();
        onEdgeClick(d.edge);
      });

    const nodeSel = g
      .append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer");

    nodeSel
      .append("circle")
      .attr("r", 11)
      .attr("stroke-width", 2)
      .attr("stroke", (d) =>
        highlightedSegmentIds.has(d.id)
          ? "#a855f7"
          : "#475569",
      )
      .attr("fill", (d) => SUBMISSION_FILL[(subIndex.get(d.submission_id) ?? 0) % SUBMISSION_FILL.length])
      .attr("opacity", (d) => {
        if (highlightedSegmentIds.size === 0) return 1;
        return highlightedSegmentIds.has(d.id) ? 1 : 0.18;
      });

    nodeSel
      .append("text")
      .text((d) => d.segment_id.replace(/^S\d+_/, ""))
      .attr("text-anchor", "middle")
      .attr("dy", 22)
      .attr("font-size", 9)
      .attr("fill", "currentColor")
      .attr("class", "text-slate-600 dark:text-slate-400");

    nodeSel
      .filter((d) => selectedSegmentIds.has(d.id))
      .select("circle")
      .attr("stroke", "#f43f5e")
      .attr("stroke-width", 3);

    nodeSel
      .filter((d) => hoveredSegmentId === d.id)
      .select("circle")
      .attr("stroke", "#0ea5e9")
      .attr("stroke-width", 3);

    nodeSel.on("click", (event: MouseEvent, d) => {
      event.stopPropagation();
      onNodeClickRef.current(d.id, event.ctrlKey || event.metaKey);
    });
    nodeSel.on("mouseenter", (_, d) => onNodeHover(d.id));
    nodeSel.on("mouseleave", () => onNodeHover(null));

    const syncPositions = () => {
      linkSel
        .attr("x1", (d) => (d.source as SegmentNodeModel).x!)
        .attr("y1", (d) => (d.source as SegmentNodeModel).y!)
        .attr("x2", (d) => (d.target as SegmentNodeModel).x!)
        .attr("y2", (d) => (d.target as SegmentNodeModel).y!);

      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    };

    if (layoutMode === "hierarchical") {
      syncPositions();
      return () => undefined;
    }

    const sim = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SegmentNodeModel, (typeof links)[0]>(links)
          .id((d) => d.id)
          .distance((d) => 42 + (1 - d.edge.confidence) * 55),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SegmentNodeModel>().radius(20));

    sim.on("tick", syncPositions);

    simRef.current = sim;

    const nodeDrag = d3
      .drag<SVGGElement, SegmentNodeModel>()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.28).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = undefined;
        d.fy = undefined;
      });
    nodeSel.call(nodeDrag as Parameters<typeof nodeSel.call>[0]);

    return () => {
      sim.stop();
    };
  }, [
    nodes,
    edges,
    layoutMode,
    submissionOrder,
    selectedSegmentIds,
    highlightedSegmentIds,
    hoveredSegmentId,
    selectedEdgeId,
    replayEdgeCount,
    onNodeHover,
    onEdgeClick,
    onBackgroundClick,
  ]);

  useEffect(() => {
    const cleanup = build();
    return () => {
      cleanup?.();
    };
  }, [build]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => build());
    ro.observe(el);
    return () => ro.disconnect();
  }, [build]);

  return (
    <div
      ref={setContainerRef}
      className={cn(
        "relative w-full rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40",
        className,
      )}
    >
      <svg ref={svgRef} className="block w-full" style={{ minHeight: 560 }} />
      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-[#22c55e]" /> Type 1
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-[#3b82f6]" /> Type 2
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-sm bg-[#f97316]" /> Type 3
        </span>
        <span className="opacity-80">Ctrl/Cmd+click multi-select · Drag nodes · Scroll zoom</span>
      </div>
    </div>
  );
});
