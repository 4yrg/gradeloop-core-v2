"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { studentCoursesApi } from "@/lib/api/academics";
import type { StudentCourseEnrollment } from "@/types/academics.types";

/**
 * Dynamic sidebar secondary panel for students.
 * Fetches enrolled courses and groups them by semester.
 */
export function StudentCourseNav() {
  const pathname = usePathname();
  const [enrollments, setEnrollments] = React.useState<StudentCourseEnrollment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  // Track which semester sections are expanded (all open by default)
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    let mounted = true;

    async function fetchEnrollments() {
      try {
        setIsLoading(true);
        const data = await studentCoursesApi.listMyEnrollments();
        if (mounted) {
          setEnrollments(data);
          // Default: expand all semesters
          const defaultExpanded: Record<string, boolean> = {};
          const semesterIds = [...new Set(data.map((e) => e.semester_id))];
          semesterIds.forEach((id) => {
            defaultExpanded[id] = true;
          });
          setExpanded(defaultExpanded);
        }
      } catch {
        // Silently fail — the main page can show the error
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchEnrollments();
    return () => {
      mounted = false;
    };
  }, []);

  // Group enrollments by semester
  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      { semesterId: string; semesterName: string; items: StudentCourseEnrollment[] }
    >();
    for (const e of enrollments) {
      if (!map.has(e.semester_id)) {
        map.set(e.semester_id, {
          semesterId: e.semester_id,
          semesterName: e.semester_name,
          items: [],
        });
      }
      map.get(e.semester_id)!.items.push(e);
    }
    return [...map.values()];
  }, [enrollments]);

  const toggleSemester = (semesterId: string) => {
    setExpanded((prev) => ({ ...prev, [semesterId]: !prev[semesterId] }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-1 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 px-2 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No enrolled courses</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      {grouped.map((group) => {
        const isOpen = expanded[group.semesterId] ?? true;
        return (
          <div key={group.semesterId} className="flex flex-col gap-0.5">
            {/* Semester header */}
            <button
              onClick={() => toggleSemester(group.semesterId)}
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-sidebar-accent text-left transition-colors group"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground truncate">
                {group.semesterName}
              </span>
              {isOpen ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </button>

            {/* Course links */}
            {isOpen && (
              <div className="flex flex-col gap-0.5 pl-2">
                {group.items.map((enrollment) => {
                  const href = `/student/courses/${enrollment.course_instance_id}`;
                  const isActive =
                    pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link key={enrollment.course_instance_id} href={href} className="w-full">
                      <Button
                        variant="ghost"
                        className={cn(
                          "h-9 w-full flex items-center rounded-lg transition-colors justify-start px-3 gap-2",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                        )}
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <div className="flex flex-col items-start overflow-hidden">
                          <span className="text-xs font-medium truncate leading-tight">
                            {enrollment.course_code}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate leading-tight">
                            {enrollment.course_title}
                          </span>
                        </div>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
