"use client";

import * as React from "react";
import {
  User,
  Mail,
  Hash,
  Calendar,
  Clock,
  GraduationCap,
  Briefcase,
  Edit,
  ShieldOff,
  Trash2,
  MoreVertical,
  FileUp,
  AlertCircle,
  LogIn,
  KeyRound,
  UserCog,
} from "lucide-react";
import {
  SideDialog,
  SideDialogContent,
  SideDialogHeader,
  SideDialogTitle,
} from "@/components/ui/side-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { usersApi } from "@/lib/api/users";
import type { UserListItem } from "@/types/auth.types";
import type { UserActivityLog } from "@/lib/api/users";

interface Props {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: UserListItem) => void;
  onRevokeSessions: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
}

function getInitials(fullName: string, email: string) {
  const name = fullName || email;
  return name
    .split(/[.\-_\s@]/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { dateStyle: "medium" });
}

function roleBadgeVariant(roleName: string) {
  const lower = roleName.toLowerCase();
  if (lower.includes("admin")) return "purple" as const;
  if (lower.includes("instructor") || lower.includes("teacher"))
    return "info" as const;
  if (lower.includes("student") || lower.includes("learner"))
    return "success" as const;
  return "secondary" as const;
}

function getActivityIcon(action: string) {
  const lower = action.toLowerCase();
  if (
    lower.includes("update") ||
    lower.includes("modify") ||
    lower.includes("edit")
  )
    return <FileUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  if (lower.includes("login"))
    return <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />;
  if (lower.includes("grade"))
    return (
      <GraduationCap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
    );
  if (lower.includes("password") || lower.includes("credential"))
    return (
      <KeyRound className="h-4 w-4 text-purple-600 dark:text-purple-400" />
    );
  if (lower.includes("create") || lower.includes("add"))
    return <UserCog className="h-4 w-4 text-primary dark:text-primary-fixed" />;
  return <AlertCircle className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />;
}

function getActivityColor(action: string) {
  const lower = action.toLowerCase();
  if (
    lower.includes("update") ||
    lower.includes("modify") ||
    lower.includes("edit")
  )
    return "bg-blue-50 dark:bg-blue-900/20";
  if (lower.includes("login")) return "bg-green-50 dark:bg-green-900/20";
  if (lower.includes("grade")) return "bg-orange-50 dark:bg-orange-900/20";
  if (lower.includes("password") || lower.includes("credential"))
    return "bg-purple-50 dark:bg-purple-900/20";
  if (lower.includes("create") || lower.includes("add"))
    return "bg-primary/10 dark:bg-primary/20";
  return "bg-muted/30 dark:bg-muted/10";
}

export function UserProfileSideDialog({
  user,
  open,
  onOpenChange,
  onEdit,
  onRevokeSessions,
  onDelete,
}: Props) {
  const [activities, setActivities] = React.useState<UserActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user && open) {
      setLoadingActivities(true);
      setApiError(null);
      usersApi
        .getActivity(user.id, 1, 10)
        .then((response) => {
          setActivities(response.data);
        })
        .catch((err) => {
          // Handle 404 - endpoint not implemented yet
          if (err.response?.status === 404) {
            setApiError("Activity logs are not available yet");
          } else {
            setApiError("Failed to load activity logs");
          }
          setActivities([]);
        })
        .finally(() => {
          setLoadingActivities(false);
        });
    }
  }, [user, open]);

  if (!user) return null;

  return (
    <SideDialog open={open} onOpenChange={onOpenChange}>
      <SideDialogContent className="max-w-xl">
        <SideDialogHeader>
          <SideDialogTitle>User Profile</SideDialogTitle>
        </SideDialogHeader>

        {/* Profile Header */}
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 text-xl shrink-0 rounded-2xl border-4 border-background shadow-lg">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-bold">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-foreground font-serif tracking-tight">
                  {user.full_name || "No Name"}
                </h2>
                <Badge variant={roleBadgeVariant(user.user_type)} className="capitalize">
                  {user.user_type}
                </Badge>
                <Badge variant={user.is_active ? "success" : "destructive"}>
                  {user.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                {user.email}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  User Type: {user.user_type || "N/A"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined{" "}
                  {new Date(user.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last Active {formatRelativeTime(user.last_login_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Account Details */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 uppercase tracking-widest opacity-70">
              <User className="h-4 w-4" />
              Account Details
            </h3>
            <div className="grid gap-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-32 shrink-0">
                  <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                    Email Address
                  </span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground/60" />
                  {user.email}
                </div>
              </div>

              {user.student_id && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-32 shrink-0">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">
                      Student ID
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <Hash className="h-4 w-4 text-zinc-400" />
                    {user.student_id}
                  </div>
                </div>
              )}

              {user.designation && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-32 shrink-0">
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">
                      Designation
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <Briefcase className="h-4 w-4 text-zinc-400" />
                    {user.designation}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <div className="w-32 shrink-0">
                  <span className="text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide">
                    User ID
                  </span>
                </div>
                <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-mono text-xs">
                  <Hash className="h-4 w-4 text-zinc-400" />
                  {user.id}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Activity & Audit Log */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-widest opacity-70">
                <ActivityIcon className="h-4 w-4" />
                Activity & Audit Log
              </h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                View Full History
                <MoreVertical className="h-3 w-3" />
              </Button>
            </div>

            {loadingActivities ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : apiError ? (
              <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/50">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">{apiError}</p>
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`p-4 rounded-xl border border-border/50 transition-colors hover:border-primary/30 ${getActivityColor(activity.action)}`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2 rounded-full bg-background shadow-sm shrink-0 border border-border/50`}
                      >
                        {getActivityIcon(activity.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-foreground">
                            {activity.action}
                          </p>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                            {formatRelativeTime(activity.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground/80 mt-1 leading-relaxed">
                          {activity.description}
                        </p>
                        {activity.metadata &&
                          Object.keys(activity.metadata).length > 0 && (
                            <div className="mt-2 p-2 bg-white/50 dark:bg-zinc-900/50 rounded text-xs text-zinc-500 dark:text-zinc-400">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(activity.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-full px-4 shadow-sm"
            onClick={() => {
              onOpenChange(false);
              onEdit(user);
            }}
          >
            <Edit className="h-4 w-4" />
            Edit User
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-full px-4 shadow-sm"
            onClick={() => {
              onOpenChange(false);
              onRevokeSessions(user);
            }}
          >
            <ShieldOff className="h-4 w-4" />
            Revoke Sessions
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-full px-4 shadow-sm text-error hover:text-error hover:bg-error/10 border-error/20"
            onClick={() => {
              onOpenChange(false);
              onDelete(user);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </SideDialogContent>
    </SideDialog>
  );
}

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
