"use client";

import * as React from "react";
import {
  Building2,
  CreditCard,
  Download,
  Search,
  MoreHorizontal,
  Plus,
  Minus,
  TrendingUp,
  Users,
  HardDrive,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface TenantSubscription {
  id: string;
  tenant_name: string;
  plan: string;
  status: "active" | "trial" | "suspended";
  monthly_amount: number;
  max_users: number;
  max_courses: number;
  storage_gb: number;
  current_users: number;
  current_courses: number;
  storage_used_gb: number;
  billing_cycle: string;
  next_billing: string;
}

const mockSubscriptions: TenantSubscription[] = [
  {
    id: "1",
    tenant_name: "Stanford University",
    plan: "Enterprise",
    status: "active",
    monthly_amount: 4999,
    max_users: 10000,
    max_courses: 500,
    storage_gb: 1000,
    current_users: 4521,
    current_courses: 234,
    storage_used_gb: 456,
    billing_cycle: "Monthly",
    next_billing: "2024-02-01",
  },
  {
    id: "2",
    tenant_name: "MIT",
    plan: "Professional",
    status: "active",
    monthly_amount: 1999,
    max_users: 3000,
    max_courses: 200,
    storage_gb: 500,
    current_users: 1234,
    current_courses: 89,
    storage_used_gb: 123,
    billing_cycle: "Monthly",
    next_billing: "2024-02-15",
  },
  {
    id: "3",
    tenant_name: "Oxford University",
    plan: "Enterprise",
    status: "trial",
    monthly_amount: 4999,
    max_users: 10000,
    max_courses: 500,
    storage_gb: 1000,
    current_users: 234,
    current_courses: 12,
    storage_used_gb: 34,
    billing_cycle: "Monthly",
    next_billing: "2024-02-28",
  },
  {
    id: "4",
    tenant_name: "Cambridge",
    plan: "Starter",
    status: "active",
    monthly_amount: 499,
    max_users: 500,
    max_courses: 50,
    storage_gb: 100,
    current_users: 234,
    current_courses: 45,
    storage_used_gb: 67,
    billing_cycle: "Annual",
    next_billing: "2024-12-01",
  },
  {
    id: "5",
    tenant_name: "Harvard",
    plan: "Professional",
    status: "suspended",
    monthly_amount: 1999,
    max_users: 3000,
    max_courses: 200,
    storage_gb: 500,
    current_users: 890,
    current_courses: 67,
    storage_used_gb: 89,
    billing_cycle: "Monthly",
    next_billing: "2024-01-15",
  },
];

const planColors: Record<string, string> = {
  Enterprise: "bg-purple-100 text-purple-700",
  Professional: "bg-blue-100 text-blue-700",
  Starter: "bg-gray-100 text-gray-700",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
};

function QuotaUsageBar({
  current,
  max,
  label,
}: {
  current: number;
  max: number;
  label: string;
}) {
  const percentage = Math.min((current / max) * 100, 100);
  const getColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 75) return "bg-amber-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div
          className={`h-1.5 rounded-full transition-all ${getColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedTenant, setSelectedTenant] = React.useState<TenantSubscription | null>(null);
  const [adjustmentType, setAdjustmentType] = React.useState<"users" | "courses" | "storage">("users");
  const [adjustmentValue, setAdjustmentValue] = React.useState("");

  const filteredSubscriptions = React.useMemo(() => {
    return mockSubscriptions.filter((sub) => {
      const matchesSearch =
        !search ||
        sub.tenant_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const handleAdjustQuota = () => {
    console.log("Adjusting quota:", selectedTenant?.id, adjustmentType, adjustmentValue);
    setSelectedTenant(null);
    setAdjustmentValue("");
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Manage tenant plans and quotas</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">$9,496</p>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockSubscriptions.length}</p>
                <p className="text-sm text-muted-foreground">Active Tenants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockSubscriptions.reduce((acc, sub) => acc + sub.max_users, 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total User Quota</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <HardDrive className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockSubscriptions.reduce((acc, sub) => acc + sub.storage_gb, 0)} GB
                </p>
                <p className="text-sm text-muted-foreground">Total Storage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenant Subscriptions</CardTitle>
              <CardDescription>Manage quotas and billing for all tenants</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button
                variant={statusFilter === "active" ? "default" : "outline"}
                onClick={() => setStatusFilter("active")}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === "trial" ? "default" : "outline"}
                onClick={() => setStatusFilter("trial")}
              >
                Trial
              </Button>
              <Button
                variant={statusFilter === "suspended" ? "default" : "outline"}
                onClick={() => setStatusFilter("suspended")}
              >
                Suspended
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{sub.tenant_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={planColors[sub.plan]}>
                      {sub.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[sub.status]}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <QuotaUsageBar current={sub.current_users} max={sub.max_users} label="Users" />
                  </TableCell>
                  <TableCell>
                    <QuotaUsageBar current={sub.current_courses} max={sub.max_courses} label="Courses" />
                  </TableCell>
                  <TableCell>
                    <QuotaUsageBar current={sub.storage_used_gb} max={sub.storage_gb} label="Storage" />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">${sub.monthly_amount.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.next_billing}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedTenant(sub); setAdjustmentType("users"); }}>
                          <Users className="mr-2 h-4 w-4" />
                          Adjust User Quota
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedTenant(sub); setAdjustmentType("courses"); }}>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Adjust Course Quota
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedTenant(sub); setAdjustmentType("storage"); }}>
                          <HardDrive className="mr-2 h-4 w-4" />
                          Adjust Storage Quota
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Quota</DialogTitle>
            <DialogDescription>
              Manually adjust {adjustmentType} quota for {selectedTenant?.tenant_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New {adjustmentType} limit</Label>
              <Input
                type="number"
                placeholder={`Enter new ${adjustmentType} limit`}
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTenant(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustQuota}>
              {adjustmentType === "users" && <Plus className="mr-2 h-4 w-4" />}
              Update Quota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}