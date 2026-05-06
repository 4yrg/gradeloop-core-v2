'use client';

import React from 'react';
import { Search, Filter, Check } from 'lucide-react';
import { useTheme } from 'next-themes';

interface FiltersProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterTypes: number[];
  setFilterTypes: (types: number[]) => void;
}

const Filters: React.FC<FiltersProps> = ({ 
  searchQuery, 
  setSearchQuery, 
  filterTypes, 
  setFilterTypes 
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const toggleType = (type: number) => {
    if (filterTypes.includes(type)) {
      setFilterTypes(filterTypes.filter(t => t !== type));
    } else {
      setFilterTypes([...filterTypes, type]);
    }
  };

  return (
    <div className={`
      ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} 
      border-b px-8 py-4 flex items-center justify-between shadow-sm sticky top-[73px] z-40 backdrop-blur-md bg-opacity-80 transition-colors duration-300
    `}>
      <div className="flex items-center gap-10">
        {/* Search */}
        <div className="relative group">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`} />
          <input
            type="text"
            placeholder="Search submission or segment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`
              pl-10 pr-4 py-2 text-sm transition-all border outline-none rounded-full w-80
              ${isDark 
                ? 'bg-slate-800 border-slate-700 focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200' 
                : 'bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800'}
            `}
          />
        </div>

        {/* Clone Type Filters */}
        <div className="flex items-center gap-5">
          <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Filter className="w-3 h-3" /> Filter By Type:
          </div>
          
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`
                  flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold border transition-all active:scale-95
                  ${filterTypes.includes(type) 
                    ? type === 1 ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                    : type === 2 ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : 'bg-orange-500/10 border-orange-500 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                    : isDark 
                      ? 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}
                `}
              >
                {filterTypes.includes(type) && <Check className="w-3 h-3 animate-in zoom-in duration-300" />}
                Type {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></span>
          <span>Live Visualization</span>
        </div>
      </div>
    </div>
  );
};

export default Filters;
