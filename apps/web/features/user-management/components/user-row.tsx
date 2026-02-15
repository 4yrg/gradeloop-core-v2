"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Ban, CheckCircle } from "lucide-react";
import type { UserManagement } from "@/schemas/user-management.schema";
import { format } from "date-fns";

interface UserRowProps {
  user: UserManagement;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onEdit: (user: UserManagement) => void;
  onDelete: (user: UserManagement) => void;
  onStatusChange: (user: UserManagement, status: "active" | "inactive" | "suspended") => void;
}

const roleColors = {
  admin: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700",
  teacher: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-700",
  student: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  employee: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600",
};

const statusConfig = {
  active: {
    label: "Active",
    dotColor: "bg-green-500",
    bgColor: "bg-green-50 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-300",
    borderColor: "border-green-200 dark:border-green-700",
  },
  inactive: {
    label: "Inactive",
    dotColor: "bg-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-600 dark:text-gray-400",
    borderColor: "border-gray-200 dark:border-gray-600",
  },
  suspended: {
    label: "Suspended",
    dotColor: "bg-red-500",
    bgColor: "bg-red-50 dark:bg-red-900/30",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-200 dark:border-red-700",
  },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatLastLogin(lastLogin: string | null | undefined): string {
  if (!lastLogin) return "Never";
  
  const date = new Date(lastLogin);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return format(date, "'Today,' h:mm a");
  } else if (diffInHours < 48) {
    return format(date, "'Yesterday,' h:mm a");
  } else {
    return format(date, "MMM dd, yyyy");
  }
}

export function UserRow({
  user,
  isSelected,
  onSelectChange,
  onEdit,
  onDelete,
  onStatusChange,
}: UserRowProps) {
  const status = statusConfig[user.status];

  return (
    <tr
      className={`transition-colors group ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-background"
      }`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <Checkbox checked={isSelected} onCheckedChange={onSelectChange} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold border border-primary/30">
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.full_name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge
          variant="outline"
          className={`capitalize ${roleColors[user.role]}`}
        >
          {user.role}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bgColor} ${status.textColor} ${status.borderColor}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`}></span>
          {status.label}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 tabular-nums">
        {formatLastLogin(user.last_login)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onEdit(user)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit User
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user.status !== "active" && (
              <DropdownMenuItem onClick={() => onStatusChange(user, "active")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
            )}
            {user.status !== "suspended" && (
              <DropdownMenuItem onClick={() => onStatusChange(user, "suspended")}>
                <Ban className="mr-2 h-4 w-4" />
                Suspend
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(user)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
