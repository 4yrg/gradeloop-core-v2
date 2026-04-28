"use client";

import * as React from "react";
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CreateTenantDialog } from "@/components/admin/tenants/create-tenant-dialog";
import { EditTenantDialog } from "@/components/admin/tenants/edit-tenant-dialog";
import { DeleteTenantDialog } from "@/components/admin/tenants/delete-tenant-dialog";
import { TenantStatsDialog } from "@/components/admin/tenants/tenant-stats-dialog";
import { tenantsApi } from "@/lib/api/tenants";
import { handleApiError } from "@/lib/api/axios";
import type { Tenant } from "@/types/tenant.types";

function getInitials(name: string) {
  return name
    .split(/[.\-_\s]/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "secondary"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

const PAGE_LIMIT = 20;

export default function TenantsPage() {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTenant, setEditTenant] = React.useState<Tenant | null>(null);
  const [deleteTenant, setDeleteTenant] = React.useState<Tenant | null>(null);
  const [statsTenant, setStatsTenant] = React.useState<Tenant | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchTenants = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tenantsApi.list({
        page,
        limit: PAGE_LIMIT,
        search: debouncedSearch || undefined,
      });

      if (!result || !result.tenants) {
        setError("Invalid response from server");
        setTenants([]);
        setTotal(0);
        return;
      }

      setTenants(result.tenants);
      setTotal(result.total_count);
    } catch (err) {
      console.error("[Tenants] API error:", err);
      setError(handleApiError(err));
      setTenants([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  React.useEffect(() => {
    queueMicrotask(() => {
      fetchTenants();
    });
  }, [fetchTenants]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  function handleTenantCreated() {
    fetchTenants();
  }

  function handleTenantUpdated(updated: Tenant) {
    setTenants((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  }

  function handleTenantDeleted(id: string) {
    setTenants((prev) => prev.filter((t) => t.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenant Management</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage organizations and their settings.
          </p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Tenant
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <Building2 className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Total Tenants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {tenants.filter((t) => t.is_active).length}
              </p>
              <p className="text-xs text-zinc-500">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <Users className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {tenants.filter((t) => !t.is_active).length}
              </p>
              <p className="text-xs text-zinc-500">Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search by name, slug, or domain..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchTenants}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm overflow-hidden">
        {error && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchTenants}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="hidden md:table-cell">Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={5} />
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-16 text-center text-zinc-500"
                    >
                      <Building2 className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
                      <p className="font-medium">No tenants found</p>
                      <p className="text-sm mt-1">
                        {debouncedSearch
                          ? "Try adjusting your search."
                          : "Get started by adding the first tenant."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-sm">
                              {getInitials(tenant.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {tenant.name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500 dark:text-zinc-400">
                        {tenant.slug}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-zinc-500 dark:text-zinc-400">
                        {tenant.domain || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge active={tenant.is_active} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => setStatsTenant(tenant)}
                            >
                              <Users className="h-4 w-4" />
                              View Stats
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => setEditTenant(tenant)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                              onClick={() => setDeleteTenant(tenant)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {!loading && tenants.length > 0 && (
              <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Showing{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {(page - 1) * PAGE_LIMIT + 1}
                  </span>
                  –
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {Math.min(page * PAGE_LIMIT, total)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {total.toLocaleString()}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="text-sm text-zinc-500 px-1">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <CreateTenantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleTenantCreated}
      />
      <EditTenantDialog
        tenant={editTenant}
        open={!!editTenant}
        onOpenChange={(open) => !open && setEditTenant(null)}
        onSuccess={handleTenantUpdated}
      />
      <DeleteTenantDialog
        tenant={deleteTenant}
        open={!!deleteTenant}
        onOpenChange={(open) => !open && setDeleteTenant(null)}
        onSuccess={handleTenantDeleted}
      />
      <TenantStatsDialog
        tenant={statsTenant}
        open={!!statsTenant}
        onOpenChange={(open) => !open && setStatsTenant(null)}
      />
    </div>
  );
}