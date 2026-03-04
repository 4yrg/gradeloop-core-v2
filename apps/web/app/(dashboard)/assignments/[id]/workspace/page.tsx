'use client';

import React, { useState, useEffect } from 'react';
import { CodeIDE } from '@/components/dashboard/code-ide';
import { useIDEPermissions, useAssignmentSubmission, useCodeProject } from '@/lib/hooks/use-code-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  TrendingUp,
  FileCode,
  Send,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Mock data - replace with real API calls
const mockAssignment = {
  id: 'assignment-123',
  title: 'Algorithm Implementation: Binary Search Tree',
  description: 'Implement a binary search tree with insert, delete, and search operations.',
  dueDate: '2026-03-15T23:59:59Z',
  points: 100,
  status: 'open' as const,
  language: 'python',
  starterCode: `class Node:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None

class BinarySearchTree:
    def __init__(self):
        self.root = None
    
    def insert(self, value):
        # TODO: Implement insert method
        pass
    
    def search(self, value):
        # TODO: Implement search method
        pass
    
    def delete(self, value):
        # TODO: Implement delete method
        pass

# Test your implementation
bst = BinarySearchTree()
bst.insert(50)
bst.insert(30)
bst.insert(70)
print(bst.search(30))  # Should return True
print(bst.search(100))  # Should return False
`,
  requirements: [
    'Implement the insert() method to add nodes to the BST',
    'Implement the search() method to find nodes in the BST',
    'Implement the delete() method to remove nodes from the BST',
    'Handle edge cases (empty tree, single node, etc.)',
    'Include test cases demonstrating your implementation',
  ],
  testCases: 5,
  passingGrade: 70,
};

interface AssignmentWorkspacePageProps {
  params: {
    id: string;
  };
}

export default function AssignmentWorkspacePage({ params }: AssignmentWorkspacePageProps) {
  const router = useRouter();
  const assignmentId = params.id;
  
  // Mock user data - replace with real auth context
  const [userId] = useState('user-' + Math.random().toString(36).substr(2, 9));
  const [userRole] = useState<'student' | 'lecturer'>('student');
  const projectId = `assignment-${assignmentId}-${userId}`;
  
  const permissions = useIDEPermissions(userRole, mockAssignment.status);
  const { 
    submissionHistory, 
    isLoadingHistory, 
    currentSubmission,
    setCurrentSubmission,
    pollSubmission,
    reloadHistory 
  } = useAssignmentSubmission(assignmentId, userId);

  const [showInstructions, setShowInstructions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate time remaining
  const timeRemaining = new Date(mockAssignment.dueDate).getTime() - Date.now();
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const handleSubmit = async (submissionId: string) => {
    setIsSubmitting(true);
    try {
      // Poll for results
      const result = await pollSubmission(submissionId);
      setCurrentSubmission(result);
      
      // Reload history
      await reloadHistory();
      
      // Show results
      alert(`Submission Complete!\nStatus: ${result.status}\nGrade: ${result.grade || 'Pending'}`);
    } catch (error) {
      alert('Failed to get submission results. Please check your submissions tab.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <FileCode className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">{mockAssignment.title}</h1>
                  <p className="text-sm text-muted-foreground">
                    Due: {new Date(mockAssignment.dueDate).toLocaleString()} 
                    {timeRemaining > 0 && (
                      <span className="ml-2 text-orange-500">
                        ({daysRemaining}d {hoursRemaining}h remaining)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant="outline">
                <TrendingUp className="mr-1 h-3 w-3" />
                {mockAssignment.points} points
              </Badge>
              <Badge variant={mockAssignment.status === 'open' ? 'default' : 'secondary'}>
                {mockAssignment.status}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/assignments')}
              >
                Back to Assignments
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with Instructions and Submissions */}
        {showInstructions && (
          <div className="w-96 overflow-y-auto border-r bg-muted/20 p-6">
            <Tabs defaultValue="instructions">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="instructions">Instructions</TabsTrigger>
                <TabsTrigger value="submissions">
                  Submissions
                  {submissionHistory.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {submissionHistory.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="instructions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {mockAssignment.description}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Requirements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {mockAssignment.requirements.map((req, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {index + 1}
                          </span>
                          <span className="flex-1 text-muted-foreground">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Grading</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Test Cases:</span>
                      <span className="font-medium">{mockAssignment.testCases}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Passing Grade:</span>
                      <span className="font-medium">{mockAssignment.passingGrade}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Points:</span>
                      <span className="font-medium">{mockAssignment.points}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="submissions" className="space-y-4">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : submissionHistory.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                      <Send className="mb-2 h-12 w-12 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        No submissions yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submit your code to see results here
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  submissionHistory.map((submission, index) => (
                    <Card key={submission.submissionId}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">
                            Submission #{submissionHistory.length - index}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(submission.status)}
                            <span className="text-xs text-muted-foreground">
                              {submission.status}
                            </span>
                          </div>
                        </div>
                        <CardDescription className="text-xs">
                          {new Date(submission.submittedAt).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      {submission.grade !== undefined && (
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Grade:</span>
                            <Badge
                              variant={submission.grade >= mockAssignment.passingGrade ? 'default' : 'destructive'}
                            >
                              {submission.grade}%
                            </Badge>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Main IDE Area */}
        <div className="flex-1">
          <CodeIDE
            projectId={projectId}
            assignmentId={assignmentId}
            userId={userId}
            permissions={permissions}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/40 px-4 py-2">
        <div className="container mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>💡 Tip: Use Ctrl+S to save, Ctrl+Enter to submit</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInstructions(!showInstructions)}
          >
            {showInstructions ? 'Hide' : 'Show'} Instructions
          </Button>
        </div>
      </div>
    </div>
  );
}
