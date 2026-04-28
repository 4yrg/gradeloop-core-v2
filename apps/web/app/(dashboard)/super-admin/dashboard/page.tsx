"use client";

import * as React from "react";
import { Users, Building2, Shield, BarChart3, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface KPICardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
}

function KPICard({ title, value, description, icon }: KPICardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
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
          <p className="text-muted-foreground mt-1">Super Admin Overview</p>
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
        />
        <KPICard
          title="Total Users"
          value="2,456"
          description="Across all tenants"
          icon={<Users className="h-6 w-6 text-primary" />}
        />
        <KPICard
          title="Active Sessions"
          value="342"
          description="Currently online"
          icon={<Shield className="h-6 w-6 text-primary" />}
        />
        <KPICard
          title="API Requests"
          value="15.2K"
          description="Last 24 hours"
          icon={<BarChart3 className="h-6 w-6 text-primary" />}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Platform audit highlights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "Tenant Created", tenant: "Oxford University", time: "2 hours ago" },
                { action: "User Invited", tenant: "Stanford", time: "4 hours ago" },
                { action: "MFA Enabled", tenant: "MIT", time: "6 hours ago" },
                { action: "Role Updated", tenant: "Cambridge", time: "8 hours ago" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{item.action}</p>
                    <p className="text-sm text-muted-foreground">{item.tenant}</p>
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
              <Button variant="outline" className="w-full justify-start">
                <Building2 className="mr-2 h-4 w-4" />
                Manage Tenants
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Global Users
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Shield className="mr-2 h-4 w-4" />
                Roles & Permissions
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="mr-2 h-4 w-4" />
                Audit Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}