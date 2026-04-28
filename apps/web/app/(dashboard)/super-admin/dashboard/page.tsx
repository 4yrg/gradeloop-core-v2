"use client";

import * as React from "react";
import { 
  Building2, 
  Users, 
  Shield, 
  BarChart3, 
  Plus, 
  AlertTriangle,
  TrendingUp,
  Activity,
  Globe
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface KPICardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

function KPICard({ title, value, description, icon, trend, trendUp }: KPICardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            <div className="flex items-center gap-2 mt-1">
              {trend && (
                <span className={`text-xs ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                {trend}
                </span>
              )}
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Platform Dashboard</h1>
          <p className="text-muted-foreground mt-1">System-wide overview and management</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Tenant
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Tenants"
          value="12"
          description="Active institutes"
          icon={<Building2 className="h-6 w-6 text-primary" />}
          trend="+2 this month"
          trendUp={true}
        />
        <KPICard
          title="Total Users"
          value="24,567"
          description="Across all tenants"
          icon={<Users className="h-6 w-6 text-primary" />}
          trend="+1,234 this month"
          trendUp={true}
        />
        <KPICard
          title="Active Sessions"
          value="3,421"
          description="Currently online"
          icon={<Activity className="h-6 w-6 text-primary" />}
          trend="+12%"
          trendUp={true}
        />
        <KPICard
          title="API Requests"
          value="1.2M"
          description="Last 24 hours"
          icon={<BarChart3 className="h-6 w-6 text-primary" />}
          trend="+8.5%"
          trendUp={true}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Platform Activity</CardTitle>
            <CardDescription>Latest system-wide events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "Tenant Created", tenant: "Oxford University", time: "2 hours ago", type: "success" },
                { action: "User Invited", tenant: "Stanford University", time: "4 hours ago", type: "info" },
                { action: "MFA Enabled", tenant: "MIT", time: "6 hours ago", type: "success" },
                { action: "Security Alert", tenant: "Cambridge", time: "8 hours ago", type: "warning" },
                { action: "Role Updated", tenant: "Harvard", time: "10 hours ago", type: "info" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    {item.type === "success" && <div className="h-2 w-2 rounded-full bg-green-500" />}
                    {item.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {item.type === "info" && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                    <div>
                      <p className="font-medium">{item.action}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {item.tenant}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="w-full justify-start h-12">
                <Building2 className="mr-2 h-4 w-4" />
                Manage Tenants
              </Button>
              <Button variant="outline" className="w-full justify-start h-12">
                <Users className="mr-2 h-4 w-4" />
                Global Users
              </Button>
              <Button variant="outline" className="w-full justify-start h-12">
                <Shield className="mr-2 h-4 w-4" />
                Security Center
              </Button>
              <Button variant="outline" className="w-full justify-start h-12">
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Button>
              <Button variant="outline" className="w-full justify-start h-12">
                <TrendingUp className="mr-2 h-4 w-4" />
                Subscriptions
              </Button>
              <Button variant="outline" className="w-full justify-start h-12">
                <Activity className="mr-2 h-4 w-4" />
                Audit Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}