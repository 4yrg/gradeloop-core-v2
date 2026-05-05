"use client";

import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { CollusionGroup, CollusionEdge } from "@/types/cipas";
import { cn } from "@/lib/utils";

// Per-cluster palette — cycles if > 6 clusters
const CLUSTER_PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
];

const CLONE_TYPE_DASH: Record<string, string> = {
  "Type-1": "0",       // solid
  "Type-2": "6,3",     // dashed
  "Type-3": "2,4",     // dotted
};

export interface NetworkGraphProps {
  clusters: CollusionGroup[];
  onClusterClick?: (cluster: CollusionGroup) => void;
  /** When set, clicking a link opens side-by-side diff for this pair instead of only selecting the cluster. */
  onEdgeClick?: (cluster: CollusionGroup, edge: CollusionEdge) => void;
  className?: string;
}

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;          // student_id
  clusterId: number;   // group_id
  clusterIdx: number;  // 0-based palette index
  label: string;
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
  edge: CollusionEdge;
  clusterIdx: number;
}

export function NetworkGraph({ clusters, onClusterClick, onEdgeClick, className }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Keep a stable ref to the callback to avoid re-running the effect on every render
  const onClusterClickRef = useRef(onClusterClick);
  const onEdgeClickRef = useRef(onEdgeClick);
  useEffect(() => {
    onClusterClickRef.current = onClusterClick;
  });
  useEffect(() => {
    onEdgeClickRef.current = onEdgeClick;
  });

  const buildGraph = useCallback(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!svgEl || !container || clusters.length === 0) return;

    const width = container.clientWidth || 700;
    const height = 420;

    d3.select(svgEl).selectAll("*").remove();

    // ── Build node/link datasets ─────────────────────────────────────────
    const nodeMap = new Map<string, NodeDatum>();
    const links: LinkDatum[] = [];

    clusters.forEach((cluster, idx) => {
      cluster.member_ids.forEach((sid) => {
        if (!nodeMap.has(sid)) {
          nodeMap.set(sid, {
            id: sid,
            clusterId: cluster.group_id,
            clusterIdx: idx,
            label: sid.substring(0, 6),
          });
        }
      });
      cluster.edges.forEach((edge) => {
        links.push({
          source: edge.student_a,
          target: edge.student_b,
          edge,
          clusterIdx: idx,
        });
      });
    });

    const nodes = Array.from(nodeMap.values());

    if (nodes.length === 0) return;

    // ── SVG setup ────────────────────────────────────────────────────────
    const svg = d3
      .select(svgEl)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // Zoom / pan layer
    const g = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);
    svg.on("dblclick.zoom", () => {
      svg.call(zoom.transform, d3.zoomIdentity);
    });

    // ── Force simulation ─────────────────────────────────────────────────
    const simulation = d3
      .forceSimulation<NodeDatum>(nodes)
      .force(
        "link",
        d3
          .forceLink<NodeDatum, LinkDatum>(links)
          .id((d) => d.id)
          .distance((d) => 90 - d.edge.confidence * 30),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<NodeDatum>().radius(26));

    // ── Draw edges ───────────────────────────────────────────────────────
    const linkG = g.append("g").attr("class", "links");

    const linkEl = linkG
      .selectAll<SVGLineElement, LinkDatum>("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => CLUSTER_PALETTE[d.clusterIdx % CLUSTER_PALETTE.length])
      .attr("stroke-width", (d) => Math.max(1.5, d.edge.confidence * 5))
      .attr("stroke-opacity", 0.55)
      .attr("stroke-dasharray", (d) => CLONE_TYPE_DASH[d.edge.clone_type] ?? "0")
      .style("cursor", "pointer")
      .on("mouseenter", function (_, d) {
        d3.select(this)
          .attr("stroke-opacity", 1)
          .attr("stroke-width", Math.max(2.5, d.edge.confidence * 7));
      })
      .on("mouseleave", function (_, d) {
        d3.select(this)
          .attr("stroke-opacity", 0.55)
          .attr("stroke-width", Math.max(1.5, d.edge.confidence * 5));
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        const cluster = clusters[d.clusterIdx];
        if (!cluster) return;
        if (onEdgeClickRef.current) {
          onEdgeClickRef.current(cluster, d.edge);
        } else {
          onClusterClickRef.current?.(cluster);
        }
      });

    // Edge confidence labels
    const edgeLabelG = g.append("g").attr("class", "edge-labels").attr("pointer-events", "none");
    const edgeLabelEl = edgeLabelG
      .selectAll<SVGTextElement, LinkDatum>("text")
      .data(links)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("fill", "#64748b")
      .attr("dy", -4)
      .text((d) => `${Math.round(d.edge.confidence * 100)}%`);

    // ── Draw nodes ───────────────────────────────────────────────────────
    const nodeG = g.append("g").attr("class", "nodes");

    const drag = d3
      .drag<SVGCircleElement, NodeDatum>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const nodeEl = nodeG
      .selectAll<SVGCircleElement, NodeDatum>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 18)
      .attr("fill", (d) => CLUSTER_PALETTE[d.clusterIdx % CLUSTER_PALETTE.length])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2.5)
      .attr("fill-opacity", 0.9)
      .style("cursor", "pointer")
      .call(drag)
      .on("mouseenter", function () {
        d3.select(this).attr("r", 22).attr("stroke-width", 3);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("r", 18).attr("stroke-width", 2.5);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        const endId = (end: string | NodeDatum) =>
          typeof end === "string" ? end : (end as NodeDatum).id;
        const incident = links.filter((l) => {
          const s = endId(l.source as string | NodeDatum);
          const t = endId(l.target as string | NodeDatum);
          return s === d.id || t === d.id;
        });
        if (onEdgeClickRef.current && incident.length > 0) {
          const best = incident.reduce((a, b) =>
            a.edge.confidence >= b.edge.confidence ? a : b,
          );
          const cluster = clusters[best.clusterIdx];
          if (cluster) onEdgeClickRef.current(cluster, best.edge);
          return;
        }
        const cluster = clusters.find((c) => c.group_id === d.clusterId);
        if (cluster) onClusterClickRef.current?.(cluster);
      });

    // Node ID labels
    const nodeLabelEl = nodeG
      .selectAll<SVGTextElement, NodeDatum>("text")
      .data(nodes)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("font-size", 8)
      .attr("fill", "#fff")
      .attr("font-weight", "600")
      .attr("pointer-events", "none")
      .text((d) => d.label);

    // ── Tick ─────────────────────────────────────────────────────────────
    simulation.on("tick", () => {
      linkEl
        .attr("x1", (d) => (d.source as NodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as NodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as NodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as NodeDatum).y ?? 0);

      edgeLabelEl
        .attr(
          "x",
          (d) =>
            ((d.source as NodeDatum).x! + (d.target as NodeDatum).x!) / 2,
        )
        .attr(
          "y",
          (d) =>
            ((d.source as NodeDatum).y! + (d.target as NodeDatum).y!) / 2,
        );

      nodeEl.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      nodeLabelEl.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [clusters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run on mount and whenever clusters change; also re-run on container resize
  useEffect(() => {
    const cleanup = buildGraph();
    return cleanup;
  }, [buildGraph]);

  // Re-draw when container width changes (e.g. responsive layout reflow)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => buildGraph());
    observer.observe(container);
    return () => observer.disconnect();
  }, [buildGraph]);

  if (clusters.length === 0) {
    return (
      <div className={cn("relative w-full rounded-lg overflow-hidden", className)}>
        <div className="flex items-center justify-center h-[420px] text-sm text-muted-foreground bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 px-6 text-center">
          No clusters match the current filters. Run similarity analysis with at least two submissions that
          include source code, or adjust the confidence and status filters.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full rounded-lg overflow-hidden", className)}
    >
      <svg
        ref={svgRef}
        className="w-full bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800"
        style={{ display: "block" }}
      />

      {/* Cluster colour legend */}
      <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-1 text-[10px]">
        {clusters.map((c, i) => (
          <button
            key={c.group_id}
            type="button"
            onClick={() => onClusterClickRef.current?.(c)}
            className="flex items-center gap-1.5 hover:opacity-75 text-left"
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: CLUSTER_PALETTE[i % CLUSTER_PALETTE.length] }}
            />
            <span className="font-medium">Cluster {String.fromCharCode(64 + c.group_id)}</span>
            <span className="text-muted-foreground ml-auto pl-2">{Math.round(c.max_confidence * 100)}%</span>
          </button>
        ))}
      </div>

      {/* Edge type legend */}
      <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-1 text-[10px]">
        <div className="flex items-center gap-2">
          <svg width="20" height="8" aria-hidden>
            <line x1="0" y1="4" x2="20" y2="4" stroke="#64748b" strokeWidth="2" />
          </svg>
          <span>Type-1 (Exact)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="20" height="8" aria-hidden>
            <line x1="0" y1="4" x2="20" y2="4" stroke="#64748b" strokeWidth="2" strokeDasharray="6,3" />
          </svg>
          <span>Type-2 (Renamed)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="20" height="8" aria-hidden>
            <line x1="0" y1="4" x2="20" y2="4" stroke="#64748b" strokeWidth="2" strokeDasharray="2,4" />
          </svg>
          <span>Type-3 (Structural)</span>
        </div>
      </div>

      <div className="absolute top-3 right-3 text-[9px] text-muted-foreground bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 max-w-[240px] text-right leading-tight">
        Click a node or link to compare code · Drag nodes · Scroll zoom · Double-click resets view
      </div>
    </div>
  );
}
