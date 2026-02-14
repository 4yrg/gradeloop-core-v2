import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview and quick stats</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Export</Button>
          <Button size="sm">New Report</Button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Courses</CardTitle>
            <CardDescription>Courses you're currently teaching or enrolled in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Assignments</CardTitle>
            <CardDescription>Submissions awaiting grading</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">34</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>Active student count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,204</div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across your account</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="text-sm text-muted-foreground">Alice submitted Assignment 3 — 10 minutes ago</li>
              <li className="text-sm text-muted-foreground">New course created: Advanced Math — 1 hour ago</li>
              <li className="text-sm text-muted-foreground">Gradebook exported — yesterday</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" size="sm">View all activity</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="secondary">Create Course</Button>
              <Button variant="outline">Invite Students</Button>
              <Button variant="ghost">Settings</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

