"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { SummaryCards } from "@/components/dashboard/summary-cards"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { Timeline } from "@/components/dashboard/timeline"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back, Professor Anderson.</p>
          </div>
          <div className="text-sm text-muted-foreground bg-secondary/30 px-3 py-1 rounded-full border border-border/50">
            Spring Semester 2026
          </div>
        </div>

        <SummaryCards />

        <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-7">
          <div className="md:col-span-4 lg:col-span-4 xl:col-span-5">
            <RecentActivity />
          </div>
          <div className="md:col-span-3 lg:col-span-3 xl:col-span-2">
            <Timeline />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}