'use client';

import React, { useState, useEffect } from 'react';
import { CodeIDE } from '@/components/dashboard/code-ide';
import { useEditorStore } from '@/lib/stores/editor.store';
import { useIDEPermissions, useCodeProject } from '@/lib/hooks/use-code-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Code2, GraduationCap, BookOpen } from 'lucide-react';
import { CodeFile } from '@/types/code-editor.types';

export default function CodeEditorDemoPage() {
  const [userRole, setUserRole] = useState<'student' | 'lecturer'>('student');
  const [projectId] = useState('demo-project-' + Date.now());
  const [userId] = useState('demo-user-123');
  const [assignmentId] = useState('assignment-456');
  const { setFiles, addFile } = useEditorStore();

  const permissions = useIDEPermissions(userRole, 'open');

  // Initialize with demo files
  useEffect(() => {
    const demoFiles: CodeFile[] = [
      {
        id: 'file-1',
        name: 'index.js',
        path: 'index.js',
        content: `// Welcome to the GradeLoop IDE!
// This is a fully-featured code editor with MinIO storage and RabbitMQ submission queue

function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return \`Welcome to GradeLoop, \${name}\`;
}

// Call the function
const message = greet('Student');
console.log(message);

// TODO: Complete your assignment here
`,
        language: 'javascript',
        isModified: false,
      },
      {
        id: 'file-2',
        name: 'solution.py',
        path: 'solution.py',
        content: `"""
Python Assignment Solution
GradeLoop Code Editor Demo
"""

def calculate_fibonacci(n):
    """Calculate the nth Fibonacci number"""
    if n <= 1:
        return n
    return calculate_fibonacci(n - 1) + calculate_fibonacci(n - 2)

def main():
    # Test the Fibonacci function
    for i in range(10):
        print(f"Fibonacci({i}) = {calculate_fibonacci(i)}")

if __name__ == "__main__":
    main()
`,
        language: 'python',
        isModified: false,
      },
      {
        id: 'file-3',
        name: 'README.md',
        path: 'README.md',
        content: `# Assignment Instructions

## Overview
This assignment tests your understanding of algorithms and data structures.

## Tasks
1. Implement the Fibonacci sequence calculator
2. Optimize the solution for large numbers
3. Add unit tests

## Submission
- Click the **Submit** button when ready
- Your code will be queued for compilation and testing
- Results will be available in your submissions history

## Features Available
- **Auto-save**: Changes are saved automatically every 30 seconds
- **Keyboard Shortcuts**: 
  - \`Ctrl/Cmd + S\`: Save current file
  - \`Ctrl/Cmd + Shift + S\`: Save all files
  - \`Ctrl/Cmd + Enter\`: Submit code
- **Multi-file Support**: Create, edit, and manage multiple files
- **Cloud Storage**: All files are stored securely in MinIO

Good luck! 🚀
`,
        language: 'markdown',
        isModified: false,
      },
    ];

    setFiles(demoFiles);
  }, [setFiles]);

  const handleSubmit = (submissionId: string) => {
    alert(`Code submitted! Submission ID: ${submissionId}\n\nYour code is now in the queue for evaluation.`);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">GradeLoop Code IDE</h1>
                <p className="text-sm text-muted-foreground">
                  Integrated Development Environment with Cloud Storage & Submission Queue
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Role:</span>
                <div className="flex gap-2">
                  <Button
                    variant={userRole === 'student' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUserRole('student')}
                  >
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Student
                  </Button>
                  <Button
                    variant={userRole === 'lecturer' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUserRole('lecturer')}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Lecturer
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Permissions Display */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant={permissions.canEdit ? 'default' : 'secondary'}>
              {permissions.canEdit ? '✓' : '✗'} Edit Code
            </Badge>
            <Badge variant={permissions.canSubmit ? 'default' : 'secondary'}>
              {permissions.canSubmit ? '✓' : '✗'} Submit Assignments
            </Badge>
            <Badge variant={permissions.canReview ? 'default' : 'secondary'}>
              {permissions.canReview ? '✓' : '✗'} Review Submissions
            </Badge>
            <Badge variant={permissions.canGrade ? 'default' : 'secondary'}>
              {permissions.canGrade ? '✓' : '✗'} Grade Students
            </Badge>
            <Badge variant={permissions.canCreateTemplates ? 'default' : 'secondary'}>
              {permissions.canCreateTemplates ? '✓' : '✗'} Create Templates
            </Badge>
          </div>
        </div>
      </div>

      {/* IDE Container */}
      <div className="flex-1 overflow-hidden">
        <CodeIDE
          projectId={projectId}
          assignmentId={assignmentId}
          userId={userId}
          permissions={permissions}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Footer Info */}
      <div className="border-t bg-muted/40 px-4 py-2">
        <div className="container mx-auto">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>💾 Files stored in MinIO</span>
              <span>⚡ Submissions queued via RabbitMQ</span>
              <span>🔄 Auto-save enabled</span>
            </div>
            <div>
              <span>Monaco Editor v{require('@monaco-editor/react/package.json').version}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
