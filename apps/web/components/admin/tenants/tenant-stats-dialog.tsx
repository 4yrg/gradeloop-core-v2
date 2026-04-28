"use client";

import * as React from "react";
import { Building2, Users, UserCheck, UserX, GraduationCap, BookOpen, Shield, Crown } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { tenantsApi } from "@/lib/api/tenants";
import type { Tenant, TenantStats } from "@/types/tenant.types";

interface TenantStatsDialogProps {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantStatsDialog({
  tenant,
  open,
  onOpenChange,
}: TenantStatsDialogProps) {
  const [stats, setStats] = React.useState<TenantStats | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (tenant && open) {
      setLoading(true);
      tenantsApi
        .getStats(tenant.id)
        .then(setStats)
        .finally(() => setLoading(false));
    }
  }, [tenant, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {tenant?.name} - Statistics
          </DialogTitle>
          <DialogDescription>
            User breakdown for this tenant.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Users className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total_users}</p>
                    <p className="text-xs text-zinc-500">Total Users</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                    <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.active_users}</p>
                    <p className="text-xs text-zinc-500">Active</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.student_count}</p>
                    <p className="text-xs text-zinc-500">Students</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.instructor_count}</p>
                    <p className="text-xs text-zinc-500">Instructors</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.admin_count}</p>
                    <p className="text-xs text-zinc-500">Admins</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Crown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.super_admin_count}</p>
                    <p className="text-xs text-zinc-500">Super Admins</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
              Inactive users: {stats.inactive_users}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No statistics available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}