"use client";

import * as React from "react";
import {
    Users,
    BookOpen,
    CheckSquare,
    BarChart3,
    PlusCircle,
    MessageSquare
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InstructorDashboardPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Instructor Dashboard</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                    Manage your courses and students effectively.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">My Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">4</div>
                        <p className="text-xs text-zinc-500 mt-1">1,240 total students</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                        <CheckSquare className="h-4 w-4 text-pink-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">42</div>
                        <p className="text-xs text-orange-600 font-medium mt-1">12 assignments overdue for grading</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Class Attendance</CardTitle>
                        <BarChart3 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">94%</div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">+2% from last week</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Recent Student Questions</CardTitle>
                        <CardDescription>Respond to your students' inquiries</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { name: "John Doe", question: "Can I get an extension on the React project?", course: "Web Dev 101" },
                                { name: "Sarah Smith", question: "Struggling with the SQL join assignment.", course: "Database Systems" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-4 pb-4 last:pb-0 border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                                    <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                        <MessageSquare className="h-5 w-5 text-zinc-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{item.name} • {item.course}</p>
                                        <p className="text-sm text-zinc-500 italic mt-1">&quot;{item.question}&quot;</p>
                                        <Button variant="link" size="sm" className="px-0 h-auto mt-2">Reply</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm p-6 flex flex-col items-center justify-center text-center gap-4 border-dashed">
                    <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <PlusCircle className="h-6 w-6 text-zinc-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium">Create New Course Content</h3>
                        <p className="text-sm text-zinc-500">Add lectures, quizzes, or assignments to your courses.</p>
                    </div>
                    <Button>Get Started</Button>
                </Card>
            </div>
        </div>
    );
}
