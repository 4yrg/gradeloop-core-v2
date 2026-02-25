"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  FileText,
  Clock,
  Users,
  Calendar,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Assignment } from "@/types/assessment.types";

interface AssignmentCardProps {
  assignment: Assignment;
}

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const router = useRouter();

  const getDueDateStatus = () => {
    if (!assignment.due_at) return null;

    const now = new Date();
    const dueDate = new Date(assignment.due_at);
    const lateDueDate = assignment.late_due_at
      ? new Date(assignment.late_due_at)
      : null;

    if (now > dueDate && (!lateDueDate || now > lateDueDate)) {
      return { status: "overdue", color: "text-red-600", label: "Overdue" };
    } else if (now > dueDate && lateDueDate && now <= lateDueDate) {
      return { status: "late", color: "text-orange-600", label: "Late Period" };
    } else {
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue < 24) {
        return { status: "urgent", color: "text-orange-600", label: "Due Soon" };
      }
      return { status: "active", color: "text-green-600", label: "Active" };
    }
  };

  const dueDateStatus = getDueDateStatus();

  const handleOpenAssignment = () => {
    router.push(`/student/assignments/${assignment.id}`);
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg">{assignment.title}</CardTitle>
            {assignment.code && (
              <Badge variant="secondary" className="text-xs">
                {assignment.code}
              </Badge>
            )}
          </div>
          {dueDateStatus && (
            <Badge
              variant={dueDateStatus.status === "overdue" ? "destructive" : "outline"}
              className={dueDateStatus.color}
            >
              {dueDateStatus.label}
            </Badge>
          )}
        </div>
        {assignment.description && (
          <CardDescription className="line-clamp-2 mt-2">
            {assignment.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {assignment.due_at && (
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Calendar className="h-4 w-4" />
              <div>
                <p className="text-xs text-zinc-500">Due Date</p>
                <p className="font-medium">
                  {format(new Date(assignment.due_at), "MMM dd, yyyy h:mm a")}
                </p>
              </div>
            </div>
          )}
          {assignment.enforce_time_limit && (
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Clock className="h-4 w-4" />
              <div>
                <p className="text-xs text-zinc-500">Time Limit</p>
                <p className="font-medium">{assignment.enforce_time_limit} minutes</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {assignment.allow_group_submission && (
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Group Allowed (Max {assignment.max_group_size})
            </Badge>
          )}
          {assignment.allow_late_submissions && (
            <Badge variant="outline" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Late Submissions OK
            </Badge>
          )}
          {assignment.enable_ai_assistant && (
            <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950">
              AI Assistant Available
            </Badge>
          )}
        </div>

        <Button
          onClick={handleOpenAssignment}
          className="w-full"
          variant="default"
        >
          Open Assignment
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
