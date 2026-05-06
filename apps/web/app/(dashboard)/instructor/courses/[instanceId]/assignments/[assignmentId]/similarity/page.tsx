'use client';

import React, { useState, useMemo } from 'react';
import { mockSubmissions } from '@/components/similarity/mockData';
import SimilarityGraph from '@/components/similarity/SimilarityGraph';
import ComparisonPanel from '@/components/similarity/ComparisonPanel';
import Filters from '@/components/similarity/Filters';
import { AnimatePresence } from 'framer-motion';
import { Share2, Download, AlertCircle, ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function SimilarityPage() {
  const params = useParams();
  const router = useRouter();
  const { instanceId, assignmentId } = params;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTypes, setFilterTypes] = useState<number[]>([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery) return mockSubmissions;
    
    const query = searchQuery.toLowerCase();
    return mockSubmissions.filter(sub => 
      sub.submission_id.toLowerCase().includes(query) ||
      sub.student_name.toLowerCase().includes(query) ||
      sub.segments.some(seg => seg.segment_id.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  const handleSelectNode = (nodeData: any) => {
    setSelectedEdge(null);
    setSelectedNode(nodeData);
  };

  const handleSelectEdge = (edgeData: any) => {
    setSelectedNode(null);
    setSelectedEdge(edgeData);
  };

  const handleClosePanel = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-5 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Similarity Network Graph</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Assignment ID: {assignmentId}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-bold border border-red-100 dark:border-red-900/50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            4 High-Risk Clusters Detected
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </header>

      {/* Filters */}
      <Filters 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        filterTypes={filterTypes} 
        setFilterTypes={setFilterTypes} 
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden p-8 gap-8 relative">
        <div className="flex-1 min-h-[600px] bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
          <SimilarityGraph 
            submissions={filteredSubmissions} 
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            filterTypes={filterTypes}
          />
        </div>

        {/* Side Panel (AnimatePresence for smooth slide) */}
        <AnimatePresence mode="wait">
          {(selectedNode || selectedEdge) && (
            <ComparisonPanel 
              selectedNode={selectedNode} 
              selectedEdge={selectedEdge} 
              onClose={handleClosePanel} 
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-8 py-4 text-xs text-slate-400 dark:text-slate-500 flex justify-between items-center">
        <div className="flex gap-6">
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600"></div>
            Total Submissions: 20
          </span>
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-600"></div>
            Clusters Identified: 12
          </span>
        </div>
        <div>
          Powered by GradeLoop Similarity Engine v2.0
        </div>
      </footer>
    </div>
  );
}
