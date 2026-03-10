"use client";

import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  getStudentName,
  getStudentInitials,
  getStudentColor,
  getStudentProfile,
} from "@/lib/dummy-students";
import { cn } from "@/lib/utils";
import { Mail, GraduationCap, Calendar, User } from "lucide-react";

export interface StudentAvatarProps {
  /** The student / submission ID to resolve */
  studentId: string;
  /** Size variant */
  size?: "xs" | "sm" | "md";
  /** Show the name alongside the avatar */
  showName?: boolean;
  /** Additional classes on the outer wrapper */
  className?: string;
}

const sizeClasses = {
  xs: "h-5 w-5 text-[8px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-xs",
} as const;

const nameSizeClasses = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
} as const;

/**
 * A clickable avatar that resolves a student/submission ID
 * to a name + initials and shows a mini-profile popover on click.
 */
export function StudentAvatar({
  studentId,
  size = "sm",
  showName = true,
  className,
}: StudentAvatarProps) {
  const profile = getStudentProfile(studentId);
  const initials = getStudentInitials(studentId);
  const name = getStudentName(studentId);
  const color = getStudentColor(studentId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          title={name}
        >
          <Avatar className={cn(sizeClasses[size], "flex-shrink-0 border border-white dark:border-slate-900")}>
            <AvatarFallback className={cn(color, "text-white font-bold")}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {showName && (
            <span className={cn("font-medium truncate max-w-[120px]", nameSizeClasses[size])}>
              {name}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="w-64 p-0 overflow-hidden"
      >
        {/* Banner */}
        <div className={cn(color, "h-10 w-full")} />

        {/* Profile content */}
        <div className="px-4 pb-4 -mt-5">
          <Avatar className="h-10 w-10 border-2 border-background mb-2">
            <AvatarFallback className={cn(color, "text-white font-bold text-sm")}>
              {initials}
            </AvatarFallback>
          </Avatar>

          <h4 className="text-sm font-semibold">{profile.name}</h4>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{profile.email}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GraduationCap className="h-3 w-3 flex-shrink-0" />
              <span>{profile.department}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Enrolled {profile.enrollmentYear}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <User className="h-2.5 w-2.5 mr-1" />
              Student
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {studentId.substring(0, 8)}
            </Badge>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
