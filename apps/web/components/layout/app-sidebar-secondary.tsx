"use client";

import * as React from "react";
import { AlertCircle, Filter } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

export function AppSidebarSecondary() {
  return (
    <Sidebar 
      collapsible="none"
      className="w-[var(--shell-sidebar-secondary-width)] border-r border-[hsl(var(--shell-border))] bg-[hsl(var(--shell-sidebar-bg))] text-[hsl(var(--shell-sidebar-fg))] z-20"
    >
      <SidebarHeader className="h-[var(--shell-header-height)] px-8 flex items-center border-b border-[hsl(var(--shell-border))]">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-primary" />
          <span className="font-bold text-lg tracking-tight text-[hsl(var(--shell-sidebar-fg))]">Course Performance</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-8 py-8 space-y-10 overflow-y-auto">
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-[hsl(var(--shell-sidebar-fg))]/30 uppercase tracking-[0.2em]">Select Semester</label>
          <Select defaultValue="fall-2024">
            <SelectTrigger className="w-full bg-white/5 border-[hsl(var(--shell-border))] h-12 rounded-xl text-sm font-medium text-[hsl(var(--shell-sidebar-fg))] focus:ring-primary/20">
              <SelectValue placeholder="Select Semester" />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(var(--shell-sidebar-bg))] border-[hsl(var(--shell-border))] text-[hsl(var(--shell-sidebar-fg))] rounded-xl">
              <SelectItem value="fall-2024">Fall 2024</SelectItem>
              <SelectItem value="spring-2024">Spring 2024</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-5">
          <label className="text-[10px] font-bold text-[hsl(var(--shell-sidebar-fg))]/30 uppercase tracking-[0.2em]">Course Category</label>
          <div className="space-y-4">
            {[
              "Advanced Algorithm",
              "React Patterns",
              "Python Backend"
            ].map((category, i) => (
              <div key={category} className="flex items-center group cursor-pointer">
                <Checkbox 
                  id={`cat-${i}`} 
                  defaultChecked={i !== 1} 
                  className="h-5 w-5 border-[hsl(var(--shell-sidebar-fg))]/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all rounded-md" 
                />
                <label 
                  htmlFor={`cat-${i}`} 
                  className="ml-3 text-[13px] font-medium text-[hsl(var(--shell-sidebar-fg))]/70 group-hover:text-[hsl(var(--shell-sidebar-fg))] cursor-pointer transition-colors"
                >
                  {category}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-[hsl(var(--shell-sidebar-fg))]/30 uppercase tracking-[0.2em]">Performance Range</label>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">45% - 100%</span>
          </div>
          <div className="px-1">
            <Slider defaultValue={[45]} max={100} step={1} className="py-2" />
            <div className="flex justify-between mt-3 text-[10px] font-bold text-[hsl(var(--shell-sidebar-fg))]/20 tracking-tighter">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
           <label className="text-[10px] font-bold text-[hsl(var(--shell-sidebar-fg))]/30 uppercase tracking-[0.2em]">Active Anomalies</label>
           <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-3 relative overflow-hidden group hover:border-red-500/30 transition-all">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50" />
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-[11px] font-bold tracking-tight">Low Completion Rate</span>
              </div>
              <p className="text-[11px] text-[hsl(var(--shell-sidebar-fg))]/40 leading-relaxed font-medium">
                Unit 4: Recursion has a <span className="text-red-400/80 font-bold">40% drop-off rate</span> this week. Recommend intervention.
              </p>
           </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
