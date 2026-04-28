"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatCardProps {
  title: string;
  value: string | number;
  change: string;
  changeUp: boolean;
  icon: React.ReactNode;
}

function StatCard({ title, value, change, changeUp, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {changeUp ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={`text-xs ${changeUp ? "text-green-500" : "text-red-500"}`}>
                {change}
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
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

const mockUserGrowth = [
  { month: "Aug", users: 15234 },
  { month: "Sep", users: 17890 },
  { month: "Oct", users: 19234 },
  { month: "Nov", users: 21356 },
  { month: "Dec", users: 22123 },
  { month: "Jan", users: 24567 },
];

const mockTenantActivity = [
  { name: "Stanford", active: 4120, total: 4521 },
  { name: "MIT", active: 1089, total: 1234 },
  { name: "Oxford", active: 187, total: 234 },
  { name: "Cambridge", active: 198, total: 234 },
  { name: "Harvard", active: 734, total: 890 },
];

const mockApiUsage = [
  { day: "Mon", requests: 156000 },
  { day: "Tue", requests: 189000 },
  { day: "Wed", requests: 167000 },
  { day: "Thu", requests: 201000 },
  { day: "Fri", requests: 178000 },
  { day: "Sat", requests: 124000 },
  { day: "Sun", requests: 98000 },
];

function SimpleBarChart({
  data,
  maxValue,
  getValue,
  getLabel,
  color,
}: {
  data: any[];
  maxValue: number;
  getValue: (item: any) => number;
  getLabel: (item: any) => string;
  color: string;
}) {
  return (
    <div className="flex items-end justify-between gap-2 h-48">
      {data.map((item, i) => {
        const value = getValue(item);
        const height = (value / maxValue) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <div className="relative w-full flex items-end justify-center h-36">
              <div
                className={`w-full max-w-12 rounded-t ${color} transition-all`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{getLabel(item)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = React.useState("30d");

  const maxUsers = Math.max(...mockUserGrowth.map((d) => d.users));
  const maxActivity = Math.max(...mockTenantActivity.map((d) => d.active));
  const maxApi = Math.max(...mockApiUsage.map((d) => d.requests));

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground mt-1">Usage metrics and insights across all tenants</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">Export Report</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <StatCard
          title="Total Users"
          value="24,567"
          change="+10.3%"
          changeUp={true}
          icon={<Users className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title="Active Sessions"
          value="3,421"
          change="+12.5%"
          changeUp={true}
          icon={<Activity className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title="API Requests"
          value="1.2M"
          change="+8.5%"
          changeUp={true}
          icon={<BarChart3 className="h-6 w-6 text-primary" />}
        />
        <StatCard
          title="Tenants"
          value="12"
          change="+2"
          changeUp={true}
          icon={<Building2 className="h-6 w-6 text-primary" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>Total users over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={mockUserGrowth}
              maxValue={maxUsers}
              getValue={(d) => d.users}
              getLabel={(d) => d.month}
              color="bg-blue-500"
            />
            <div className="mt-4 flex justify-between text-sm">
              <div>
                <p className="text-muted-foreground">Starting</p>
                <p className="text-lg font-bold">15,234</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Current</p>
                <p className="text-lg font-bold text-green-600">24,567</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant Activity</CardTitle>
            <CardDescription>Active users per tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={mockTenantActivity}
              maxValue={maxActivity}
              getValue={(d) => d.active}
              getLabel={(d) => d.name.split(" ")[0]}
              color="bg-purple-500"
            />
            <div className="mt-4 space-y-2">
              {mockTenantActivity.map((tenant) => (
                <div key={tenant.name} className="flex justify-between text-sm">
                  <span>{tenant.name}</span>
                  <span className="text-muted-foreground">
                    {tenant.active.toLocaleString()} / {tenant.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Usage by Day</CardTitle>
          <CardDescription>Request volume over the last week</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={mockApiUsage}
            maxValue={maxApi}
            getValue={(d) => d.requests}
            getLabel={(d) => d.day}
            color="bg-green-500"
          />
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total This Week</p>
              <p className="text-lg font-bold">1.11M requests</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Daily</p>
              <p className="text-lg font-bold">159K requests</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Peak Day</p>
              <p className="text-lg font-bold">201K requests</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Busiest Hour</p>
              <p className="text-lg font-bold">14:00 - 15:00</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}