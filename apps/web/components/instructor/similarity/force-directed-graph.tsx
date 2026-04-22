"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { CollusionGroup, CollusionEdge } from "@/types/cipas";

interface ForceDirectedGraphProps {
  cluster: CollusionGroup;
  onEdgeClick?: (edge: CollusionEdge) => void;
  onNodeClick?: (studentId: string) => void;
  width?: number;
  height?: number;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  edge: CollusionEdge;
}

const CLONE_TYPE_COLORS = {
  "Type-1": "#ef4444", // red
  "Type-2": "#f97316", // orange
  "Type-3": "#3b82f6", // blue
} as const;

export function ForceDirectedGraph({
  cluster,
  onEdgeClick,
  onNodeClick,
  width = 600,
  height = 400,
}: ForceDirectedGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !cluster || cluster.member_ids.length === 0) {
      return;
    }

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Prepare data
    const nodes: GraphNode[] = cluster.member_ids.map((id) => ({
      id,
      label: id.substring(0, 8), // Show first 8 chars as label
    }));

    const links: GraphLink[] = cluster.edges.map((edge) => ({
      source: edge.student_a,
      target: edge.student_b,
      edge,
    }));

    // Create SVG container
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Add zoom behavior
    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Initialize force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Draw edges
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.max(1, d.edge.confidence * 5))
      .attr(
        "stroke",
        (d) =>
          CLONE_TYPE_COLORS[d.edge.clone_type as keyof typeof CLONE_TYPE_COLORS] ||
          "#94a3b8",
      )
      .attr("stroke-opacity", 0.6)
      .style("cursor", onEdgeClick ? "pointer" : "default")
      .on("click", (event, d) => {
        if (onEdgeClick) {
          event.stopPropagation();
          onEdgeClick(d.edge);
        }
      })
      .on("mouseover", function () {
        d3.select(this).attr("stroke-opacity", 1).attr("stroke-width", (d) =>
          Math.max(2, (d as GraphLink).edge.confidence * 6),
        );
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-opacity", 0.6).attr("stroke-width", (d) =>
          Math.max(1, (d as GraphLink).edge.confidence * 5),
        );
      });

    // Add edge labels (confidence %)
    const linkLabels = g
      .append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("class", "text-[10px] fill-slate-600 dark:fill-slate-400 pointer-events-none")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .text((d) => `${Math.round(d.edge.confidence * 100)}%`);

    // Draw nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 20)
      .attr("fill", "#137fec")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", onNodeClick ? "pointer" : "grab")
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
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
          }),
      )
      .on("click", (event, d) => {
        if (onNodeClick) {
          event.stopPropagation();
          onNodeClick(d.id);
        }
      })
      .on("mouseover", function () {
        d3.select(this).attr("r", 25).attr("fill", "#1e6fcc");
      })
      .on("mouseout", function () {
        d3.select(this).attr("r", 20).attr("fill", "#137fec");
      });

    // Add node labels
    const nodeLabels = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("class", "text-xs font-medium fill-white pointer-events-none")
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .text((d) => d.label);

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      linkLabels
        .attr("x", (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr("y", (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2);

      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);

      nodeLabels.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [cluster, onEdgeClick, onNodeClick, width, height]);

  return (
    <div className="relative w-full h-full flex flex-col">
      <svg
        ref={svgRef}
        className="w-full h-full bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800"
      />
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] flex gap-4 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Type-1 (Exact)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>Type-2 (Structural)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Type-3 (Moved)</span>
        </div>
      </div>
    </div>
  );
}
