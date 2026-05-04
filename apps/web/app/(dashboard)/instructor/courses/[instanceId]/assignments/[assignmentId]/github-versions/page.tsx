"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { githubApi, type GitHubVersion } from "@/lib/api/github";
import { assessmentsApi, instructorAssessmentsApi } from "@/lib/api/assessments";
import { usersApi } from "@/lib/api/users";
import type { AssignmentResponse } from "@/types/assessments.types";
import type { UserListItem } from "@/types/auth.types";
import { GitBranch, GitCommit, Clock, CheckCircle, XCircle, Loader2, ArrowLeft, ExternalLink, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { format } from "date-fns";

interface StudentVersion {
    userId: string;
    studentName: string;
    versions: GitHubVersion[];
}

export default function GitHubVersionsPage() {
    const params = useParams();
    const assignmentId = params.assignmentId as string;

    const [assignment, setAssignment] = React.useState<AssignmentResponse | null>(null);
    const [studentVersions, setStudentVersions] = React.useState<StudentVersion[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedStudent, setSelectedStudent] = React.useState<string | null>(null);

    React.useEffect(() => {
        loadData();
    }, [assignmentId]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const assignmentData = await assessmentsApi.getAssignment(assignmentId);
            setAssignment(assignmentData);

            if (!assignmentData.use_github) {
                setError("GitHub integration is not enabled for this assignment");
                return;
            }

            const subs = await instructorAssessmentsApi.listSubmissions(assignmentId);
            
            const userIds = [...new Set(subs.map(s => s.user_id).filter(Boolean) as string[])];
            const userMap = new Map<string, UserListItem>();
            
            await Promise.all(
                userIds.map(async (uid) => {
                    try {
                        const user = await usersApi.get(uid);
                        userMap.set(uid, user);
                    } catch {
                        // ignore
                    }
                })
            );

            const groupedByUser: Map<string, GitHubVersion[]> = new Map();
            
            for (const sub of subs) {
                if (sub.user_id && sub.commit_sha) {
                    if (!groupedByUser.has(sub.user_id)) {
                        groupedByUser.set(sub.user_id, []);
                    }
                    groupedByUser.get(sub.user_id)?.push({
                        id: sub.id,
                        github_repo_id: "",
                        assignment_id: sub.assignment_id,
                        user_id: sub.user_id,
                        version: sub.version,
                        commit_sha: sub.commit_sha,
                        commit_message: "",
                        tag_name: "",
                        grade: undefined,
                        graded_at: undefined,
                        grading_status: sub.status,
                        grading_error: undefined,
                        submitted_at: sub.submitted_at,
                    });
                }
            }

            const studentVersionsData: StudentVersion[] = [];
            groupedByUser.forEach((versions, userId) => {
                const user = userMap.get(userId);
                studentVersionsData.push({
                    userId,
                    studentName: user?.full_name || `Student ${userId.slice(0, 8)}`,
                    versions: versions.sort((a, b) => b.version - a.version),
                });
            });

            setStudentVersions(studentVersionsData);
        } catch (err) {
            console.error("Failed to load data:", err);
            setError("Failed to load submission data");
        } finally {
            setIsLoading(false);
        }
    };

    const getGradingStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case "accepted":
                return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Graded</Badge>;
            case "rejected":
                return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
            case "pending":
            case "queued":
            case "running":
                return <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pending</Badge>;
            default:
                return <Badge variant="outline">{status || "Unknown"}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading submissions...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <GitBranch className="h-12 w-12 text-muted-foreground" />
                            <div>
                                <h3 className="font-semibold">GitHub Versions</h3>
                                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                            </div>
                            <Button asChild>
                                <Link href={`/instructor/courses/${params.instanceId}/assignments/${assignmentId}/submissions`}>
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Submissions
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/instructor/courses/${params.instanceId}/assignments/${assignmentId}/submissions`}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <GitBranch className="h-6 w-6" />
                            GitHub Version History
                        </h1>
                        <p className="text-muted-foreground">{assignment?.title}</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{studentVersions.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Versions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {studentVersions.reduce((sum, s) => sum + s.versions.length, 0)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Graded</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {studentVersions.reduce(
                                        (sum, s) => sum + s.versions.filter(v => v.grade !== undefined).length,
                                        0
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Student Submissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {studentVersions.map((student) => (
                                    <div key={student.userId} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>
                                                    <User className="h-4 w-4" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">{student.studentName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {student.versions.length} submission(s)
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-sm font-medium">
                                                    {student.versions[0]?.version && `Version ${student.versions[0].version}`}
                                                </p>
                                                {student.versions[0] && getGradingStatusBadge(student.versions[0].grading_status)}
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => setSelectedStudent(student.userId)}
                                            >
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4">
                    {studentVersions.map((student) => (
                        <Card key={student.userId}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>
                                                <User className="h-4 w-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <CardTitle className="text-base">{student.studentName}</CardTitle>
                                    </div>
                                    <Badge>{student.versions.length} versions</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {student.versions.map((version, idx) => (
                                        <div 
                                            key={version.id} 
                                            className={`flex items-center justify-between p-3 border rounded ${idx === 0 ? 'bg-muted/50' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <GitCommit className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm font-medium">Version {version.version}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">
                                                        {version.commit_sha?.slice(0, 7)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(version.submitted_at), "MMM d, yyyy HH:mm")}
                                                    </p>
                                                    {version.grade !== undefined && (
                                                        <p className="text-sm font-medium">{version.grade}%</p>
                                                    )}
                                                </div>
                                                {getGradingStatusBadge(version.grading_status)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    );
}