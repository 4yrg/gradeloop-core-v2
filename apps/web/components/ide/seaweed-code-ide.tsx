"use client";

import { useState, useEffect, useCallback } from "react";
import { CodeIDE } from "./code-ide";
import { FileExplorer } from "./file-explorer";
import { CommitDialog } from "./commit-dialog";
import { codeStorageApi, type CodeRepo } from "@/lib/api/code-storage";
import { assessmentsApi } from "@/lib/api/assessments";
import { Loader2, AlertCircle, Save, Send, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { STARTER_CODE } from "./constants";

interface SeaweedCodeIDEProps {
    assignmentId: string;
    assignmentTitle?: string;
    userId?: string;
    readOnly?: boolean;
    showSubmitButton?: boolean;
    onSubmit?: (versionId: string) => void;
}

const DEFAULT_FILE_BY_LANGUAGE_ID: Record<number, string> = {
    46: "main.sh",
    48: "main.c",
    49: "main.c",
    50: "main.c",
    51: "Program.cs",
    52: "main.cpp",
    53: "main.cpp",
    54: "main.cpp",
    56: "main.d",
    57: "main.exs",
    58: "main.erl",
    60: "main.go",
    61: "Main.hs",
    62: "Main.java",
    63: "main.js",
    64: "main.lua",
    68: "main.php",
    70: "main.py",
    71: "main.py",
    72: "main.rb",
    73: "main.rs",
    74: "main.ts",
    78: "Main.kt",
    80: "main.r",
    82: "main.sql",
    83: "main.swift",
    87: "Program.fs",
    95: "main.go",
};

function getDefaultFileName(languageId?: number) {
    return DEFAULT_FILE_BY_LANGUAGE_ID[languageId || 71] || "main.txt";
}

export function SeaweedCodeIDE({
    assignmentId,
    assignmentTitle,
    userId,
    readOnly = false,
    showSubmitButton = true,
    onSubmit,
}: SeaweedCodeIDEProps) {
    const [repo, setRepo] = useState<CodeRepo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentFilePath, setCurrentFilePath] = useState<string>("");
    const [currentContent, setCurrentContent] = useState<string>("");
    const [currentSHA, setCurrentSHA] = useState<string>("");
    const [showCommitDialog, setShowCommitDialog] = useState(false);
    const [commitMode, setCommitMode] = useState<"save" | "submit">("save");
    const [saving, setSaving] = useState(false);

    const initRepo = async () => {
        try {
            setLoading(true);
            setError(null);
            const repoData = await codeStorageApi.createOrGetRepo(assignmentId);
            setRepo(repoData);
        } catch (err) {
            console.error("Failed to initialize repo:", err);
            setError("Failed to connect to code storage. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        initRepo();
    }, [assignmentId]);

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
                const submission = await assessmentsApi.submitAssignment({
                    assignment_id: assignmentId,
                    code: currentContent,
                    language: repo?.language || "python",
                    language_id: repo?.language_id || 71,
                });
                toast.success(`Submitted! Version ${submission.version}`);
                onSubmit?.(submission.id);
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
                    <p className="text-sm text-muted-foreground">Connecting to code storage...</p>
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
                    useCodeStorage={true}
                    defaultNewFileName={getDefaultFileName(repo?.language_id)}
                    defaultNewFileContent={STARTER_CODE[repo?.language_id || 71] || ""}
                />
            </div>

            <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b px-4 py-2">
                    <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{repo?.storage_path || "Code Storage"}</span>
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
                        onCodeChange={handleCodeChange}
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
                useCodeStorage={true}
            />
        </div>
    );
}
