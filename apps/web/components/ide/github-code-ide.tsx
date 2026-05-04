"use client";

import { useState, useEffect, useCallback } from "react";
import { CodeIDE } from "./code-ide";
import { FileExplorer } from "./file-explorer";
import { CommitDialog } from "./commit-dialog";
import { githubApi, type GitHubRepo } from "@/lib/api/github";
import { Loader2, AlertCircle, Save, Send, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GitHubCodeIDEProps {
    assignmentId: string;
    assignmentTitle?: string;
    userId?: string;
    readOnly?: boolean;
    showSubmitButton?: boolean;
    onSubmit?: (versionId: string) => void;
}

export function GitHubCodeIDE({
    assignmentId,
    assignmentTitle,
    userId,
    readOnly = false,
    showSubmitButton = true,
    onSubmit,
}: GitHubCodeIDEProps) {
    const [repo, setRepo] = useState<GitHubRepo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentFilePath, setCurrentFilePath] = useState<string>("");
    const [currentContent, setCurrentContent] = useState<string>("");
    const [currentSHA, setCurrentSHA] = useState<string>("");
    const [showCommitDialog, setShowCommitDialog] = useState(false);
    const [commitMode, setCommitMode] = useState<"save" | "submit">("save");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        initRepo();
    }, [assignmentId]);

    const initRepo = async () => {
        try {
            setLoading(true);
            setError(null);
            const repoData = await githubApi.createOrGetRepo(assignmentId);
            setRepo(repoData);
        } catch (err) {
            console.error("Failed to initialize repo:", err);
            setError("Failed to connect to GitHub. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = useCallback((path: string, content: string, sha: string) => {
        setCurrentFilePath(path);
        setCurrentContent(content);
        setCurrentSHA(sha);
    }, []);

    const handleCodeChange = useCallback((code: string) => {
        setCurrentContent(code);
    }, []);

    const handleSave = () => {
        if (!currentFilePath) {
            toast.error("Please select a file first");
            return;
        }
        setCommitMode("save");
        setShowCommitDialog(true);
    };

    const handleSubmit = () => {
        if (!currentFilePath) {
            toast.error("Please select a file first");
            return;
        }
        setCommitMode("submit");
        setShowCommitDialog(true);
    };

    const handleCommitSuccess = async (sha: string) => {
        setCurrentSHA(sha);

        if (commitMode === "submit") {
            try {
                const version = await githubApi.submitAssignment(assignmentId, {
                    message: "Submitted assignment",
                });
                toast.success(`Submitted! Version ${version.version}`);
                onSubmit?.(version.id);
            } catch (err) {
                console.error("Submit failed:", err);
                toast.error("Failed to submit assignment");
            }
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Connecting to GitHub...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                    <Button onClick={initRepo} variant="outline">
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full">
            <div className="w-64 border-r">
                <FileExplorer
                    assignmentId={assignmentId}
                    onFileSelect={handleFileSelect}
                    currentFilePath={currentFilePath}
                    readOnly={readOnly}
                />
            </div>

            <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b px-4 py-2">
                    <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{repo?.repo_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {!readOnly && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={!currentFilePath || saving}
                                >
                                    <Save className="h-4 w-4 mr-1" />
                                    Save
                                </Button>
                                {showSubmitButton && (
                                    <Button
                                        size="sm"
                                        onClick={handleSubmit}
                                        disabled={!currentFilePath || saving}
                                    >
                                        <Send className="h-4 w-4 mr-1" />
                                        Submit
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex-1">
                    <CodeIDE
                        assignmentId={assignmentId}
                        assignmentTitle={assignmentTitle}
                        userId={userId}
                        initialCode={currentContent}
                        readOnly={readOnly}
                        showSubmitButton={false}
                        onExecute={() => {}}
                    />
                </div>
            </div>

            <CommitDialog
                open={showCommitDialog}
                onOpenChange={setShowCommitDialog}
                assignmentId={assignmentId}
                filePath={currentFilePath}
                content={currentContent}
                sha={currentSHA}
                onCommitSuccess={handleCommitSuccess}
                mode={commitMode}
            />
        </div>
    );
}