'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import { useTheme } from 'next-themes';
import { Submission, getCytoscapeElements } from './mockData';

interface SimilarityGraphProps {
  submissions: Submission[];
  onSelectNode: (nodeData: any) => void;
  onSelectEdge: (edgeData: any) => void;
  filterTypes: number[];
}

const SimilarityGraph: React.FC<SimilarityGraphProps> = ({ 
  submissions, 
  onSelectNode, 
  onSelectEdge,
  filterTypes 
}) => {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const elements = useMemo(() => {
    let allElements = getCytoscapeElements(submissions);
    
    if (filterTypes.length > 0) {
      allElements = allElements.filter(ele => {
        if (ele.data.source) {
          return filterTypes.includes(ele.data.cloneType);
        }
        return true;
      });
    }

    return allElements;
  }, [submissions, filterTypes]);

  const stylesheet: cytoscape.Stylesheet[] = useMemo(() => [
    {
      selector: 'node[type="submission"]',
      style: {
        'label': 'data(label)',
        'text-valign': 'top',
        'text-halign': 'center',
        'background-color': isDark ? '#1e293b' : '#f8fafc',
        'border-width': 2,
        'border-color': isDark ? '#334155' : '#e2e8f0',
        'shape': 'round-rectangle',
        'padding': '16px',
        'font-size': '12px',
        'color': isDark ? '#94a3b8' : '#64748b',
        'font-weight': 'bold',
        'text-margin-y': -8,
      }
    },
    {
      selector: 'node[type="segment"]',
      style: {
        'label': 'data(label)',
        'width': 28,
        'height': 28,
        'background-color': isDark ? '#0f172a' : '#ffffff',
        'border-width': 3,
        'border-color': '#3b82f6',
        'font-size': '10px',
        'color': isDark ? '#cbd5e1' : '#1e293b',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-weight': 'bold',
      }
    },
    {
      selector: 'node[cloneType=1]',
      style: { 'border-color': '#10b981' }
    },
    {
      selector: 'node[cloneType=2]',
      style: { 'border-color': '#3b82f6' }
    },
    {
      selector: 'node[cloneType=3]',
      style: { 'border-color': '#f97316' }
    },
    {
      selector: 'edge',
      style: {
        'width': 3,
        'line-color': isDark ? '#334155' : '#cbd5e1',
        'curve-style': 'bezier',
        'opacity': 0.6,
      }
    },
    {
      selector: 'edge[cloneType=1]',
      style: { 'line-color': '#10b981', 'width': 4 }
    },
    {
      selector: 'edge[cloneType=2]',
      style: { 'line-color': '#3b82f6', 'width': 4 }
    },
    {
      selector: 'edge[cloneType=3]',
      style: { 'line-color': '#f97316', 'width': 4 }
    },
    {
      selector: ':selected',
      style: {
        'border-width': 6,
        'border-color': isDark ? '#fff' : '#000',
        'line-color': isDark ? '#fff' : '#000',
        'opacity': 1,
        'z-index': 999
      }
    },
    {
      selector: 'node[risk="High"]',
      style: {
        'background-color': isDark ? '#450a0a' : '#fef2f2',
        'border-color': '#ef4444',
      }
    }
  ], [isDark]);

  const layout = {
    name: 'cose',
    padding: 60,
    animate: true,
    animationDuration: 500,
    componentSpacing: 120,
    nodeRepulsion: 8000,
    edgeElasticity: 100,
    nestingFactor: 1.2,
    gravity: 80,
  };

  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;

      cy.on('tap', 'node[type="segment"]', (evt) => {
        onSelectNode(evt.target.data());
      });

      cy.on('tap', 'edge', (evt) => {
        const edge = evt.target;
        onSelectEdge({
          edge: edge.data(),
          source: edge.source().data(),
          target: edge.target().data()
        });
      });

      cy.on('mouseover', 'node, edge', (evt) => {
        evt.target.addClass('hover');
      });

      cy.on('mouseout', 'node, edge', (evt) => {
        evt.target.removeClass('hover');
      });
    }
  }, [onSelectNode, onSelectEdge]);

  return (
    <div className={`w-full h-full transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'} rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'} overflow-hidden relative shadow-inner`}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={stylesheet}
        layout={layout}
        cy={(cy) => { cyRef.current = cy; }}
        className="cursor-pointer"
      />
      
      {/* Legend */}
      <div className={`absolute bottom-4 left-4 ${isDark ? 'bg-slate-900/90 text-slate-300 border-slate-700' : 'bg-white/80 text-slate-600 border-slate-200'} backdrop-blur-md p-4 rounded-xl border text-xs shadow-xl flex flex-col gap-3 z-10`}>
        <div className="font-bold uppercase tracking-wider opacity-50 mb-1">Clone Types</div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          <span className="font-medium">Type 1 (Exact)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
          <span className="font-medium">Type 2 (Renamed)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
          <span className="font-medium">Type 3 (Structural)</span>
        </div>
      </div>
    </div>
  );
};

export default SimilarityGraph;
