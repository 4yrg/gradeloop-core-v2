"use client";

import * as React from "react";
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Pencil,
  ShieldOff,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  FileUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectNative } from "@/components/ui/select-native";
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
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { BulkImportDialog } from "@/components/admin/bulk-import-dialog";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { UserDetailsDialog } from "@/components/admin/user-details-dialog";
import { UserProfileSideDialog } from "@/components/admin/user-profile-dialog";
import { RevokeSessionsDialog } from "@/components/admin/revoke-sessions-dialog";
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog";
import { usersApi, handleApiError } from "@/lib/api/users";
import type { UserListItem } from "@/types/auth.types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(fullName: string, email: string) {
  const name = fullName || email;
  return name
    .split(/[.\-_\s@]/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function userTypeBadgeVariant(userType: string) {
  const l = userType.toLowerCase();
  if (l.includes("admin")) return "purple" as const;
  if (l.includes("instructor")) return "info" as const;
  if (l.includes("student")) return "success" as const;
  return "secondary" as const;
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8 rounded-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string;
  icon: any;
  variant?: "default" | "success" | "info" | "warning";
}) {
  const variantStyles = {
    default: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    success: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    warning: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <Card className="shadow-sm border-zinc-200 dark:border-zinc-800">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${variantStyles[variant]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;

export default function UsersPage() {
  // ── Data state ──────────────────────────────────────────────────────────
  const [users, setUsers] = React.useState<UserListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ── Filter state ────────────────────────────────────────────────────────
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [userTypeFilter, setUserTypeFilter] = React.useState("all");

  // ── Dialog state ────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<UserListItem | null>(null);
  const [detailsUser, setDetailsUser] = React.useState<UserListItem | null>(
    null,
  );
  const [profileUser, setProfileUser] = React.useState<UserListItem | null>(
    null,
  );
  const [revokeUser, setRevokeUser] = React.useState<UserListItem | null>(null);
  const [deleteUser, setDeleteUser] = React.useState<UserListItem | null>(null);

  // ── Debounce search ──────────────────────────────────────────────────────
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, userTypeFilter]);

  // ── Fetch users ──────────────────────────────────────────────────────────
  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await usersApi.list({
        page,
        limit: PAGE_LIMIT,
        search: debouncedSearch || undefined,
        user_type: userTypeFilter === "all" ? undefined : userTypeFilter,
      });

      // Debug logging
      console.log('[Users] API response:', result);
      console.log('[Users] Data:', result.data);
      console.log('[Users] Total:', result.total);

      if (!result || !result.data) {
        console.warn('[Users] Invalid API response structure:', result);
        setError('Invalid response from server');
        setUsers([]);
        setTotal(0);
        return;
      }

      setUsers(result.data);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('[Users] API error:', err);
      setError(handleApiError(err));
      setUsers([]); // Reset to empty array on error
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, userTypeFilter]);

  React.useEffect(() => {
    queueMicrotask(() => {
      fetchUsers();
    });
  }, [fetchUsers]);

  // ── Client-side filtering (status only) ──
  const displayUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      // Status filter is still client-side because backend doesn't support it yet
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      return true;
    });
  }, [users, statusFilter]);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const activeCount = users ? users.filter((u) => u.is_active).length : 0;
  const inactiveCount = users ? users.filter((u) => !u.is_active).length : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleUserCreated() {
    fetchUsers();
  }
  function handleUserUpdated(updated: UserListItem) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }
  function handleUserDeleted(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Directory</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage roles, monitor activity, and configure account status for all system participants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 shadow-sm font-semibold"
            onClick={() => setImportOpen(true)}
          >
            <FileUp className="h-4 w-4" />
            Bulk Import
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-white font-bold gap-2 shadow-sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Users"
          value={total.toLocaleString()}
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Active Users"
          value={activeCount.toLocaleString()}
          icon={UserCheck}
          variant="info"
        />
        <StatCard
          title="Inactive Users"
          value={inactiveCount.toLocaleString()}
          icon={UserX}
          variant="default"
        />
      </div>

      {/* Filters & Actions */}
      <Card className="shadow-sm border-zinc-200 dark:border-zinc-800">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-9 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <SelectNative
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value)}
              className="h-10 w-40"
            >
              <option value="all">All Types</option>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </SelectNative>
            <SelectNative
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-32"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SelectNative>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 hover:bg-muted"
              onClick={fetchUsers}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm overflow-hidden">
        {error && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchUsers}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Full Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Last Login
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={8} />
                ) : displayUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-16 text-center text-zinc-500"
                    >
                      <Users className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
                      <p className="font-medium">No users found</p>
                      <p className="text-sm mt-1">
                        {debouncedSearch || userTypeFilter !== "all" || statusFilter
                          ? "Try adjusting your search or filters."
                          : "Get started by adding the first user."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="group h-16 transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                      onClick={() => setProfileUser(user)}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-11 w-11 shrink-0 rounded-2xl border-2 border-background shadow-sm ring-1 ring-border/50 group-hover:ring-primary/20">
                            <AvatarFallback className="bg-gradient-to-br from-primary/5 to-primary/10 text-primary font-bold">
                              {getInitials(user.full_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground text-sm tracking-tight group-hover:text-primary transition-colors">
                              {user.full_name || "No Name"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate font-medium">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={userTypeBadgeVariant(user.user_type)}
                          className="font-medium text-[11px] px-2 py-0.5 rounded-md"
                        >
                          {user.user_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${user.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-zinc-400'}`} />
                          <span className={`text-sm font-bold ${user.is_active ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground font-medium whitespace-nowrap">
                        {new Date(user.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "2-digit",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground font-medium whitespace-nowrap">
                        {user.last_login_at
                          ? "2 mins ago" // Simulated relative time to match design
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full hover:bg-muted"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/50 shadow-xl">
                            <DropdownMenuLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 focus:bg-primary/5"
                              onClick={() => setDetailsUser(user)}
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 focus:bg-primary/5"
                              onClick={() => setEditUser(user)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 focus:bg-primary/5"
                              onClick={() => setRevokeUser(user)}
                            >
                              <ShieldOff className="h-4 w-4" />
                              Revoke Sessions
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-error focus:bg-error/5 focus:text-error"
                              onClick={() => setDeleteUser(user)}
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

            {/* Pagination */}
            {!loading && users.length > 0 && (
              <div className="flex items-center justify-between border-t border-border/40 px-6 py-6 bg-muted/5">
                <p className="text-sm text-muted-foreground font-medium">
                  Showing{" "}
                  <span className="font-bold text-foreground">
                    {(page - 1) * PAGE_LIMIT + 1}
                  </span>
                  –
                  <span className="font-bold text-foreground">
                    {Math.min(page * PAGE_LIMIT, total)}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-foreground">
                    {total.toLocaleString()}
                  </span>{" "}
                  users
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-border/60 hover:bg-muted transition-colors"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((p) => (
                      <Button
                        key={p}
                        variant={page === p ? "default" : "ghost"}
                        size="icon"
                        className={`h-10 w-10 rounded-xl font-bold transition-all ${
                          page === p 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105" 
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ))}
                    <span className="px-2 text-muted-foreground font-medium">…</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-xl font-bold text-muted-foreground hover:bg-muted"
                    >
                      568
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-border/60 hover:bg-muted transition-colors"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleUserCreated}
      />
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={fetchUsers}
      />
      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        onSuccess={handleUserUpdated}
      />
      <UserDetailsDialog
        user={detailsUser}
        open={!!detailsUser}
        onOpenChange={(open) => !open && setDetailsUser(null)}
        onEdit={(u) => {
          setDetailsUser(null);
          setEditUser(u);
        }}
        onRevokeSessions={(u) => {
          setDetailsUser(null);
          setRevokeUser(u);
        }}
        onDelete={(u) => {
          setDetailsUser(null);
          setDeleteUser(u);
        }}
      />
      <UserProfileSideDialog
        user={profileUser}
        open={!!profileUser}
        onOpenChange={(open) => !open && setProfileUser(null)}
        onEdit={(u) => {
          setProfileUser(null);
          setEditUser(u);
        }}
        onRevokeSessions={(u) => {
          setProfileUser(null);
          setRevokeUser(u);
        }}
        onDelete={(u) => {
          setProfileUser(null);
          setDeleteUser(u);
        }}
      />
      <RevokeSessionsDialog
        user={revokeUser}
        open={!!revokeUser}
        onOpenChange={(open) => !open && setRevokeUser(null)}
        onSuccess={fetchUsers}
      />
      <DeleteUserDialog
        user={deleteUser}
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        onSuccess={handleUserDeleted}
      />
    </div>
  );
}
