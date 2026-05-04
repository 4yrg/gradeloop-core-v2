"use client";

import { useState } from "react";
import { GitCommit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { githubApi, type GitHubCommitRequest } from "@/lib/api/github";
import { toast } from "sonner";

interface CommitDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    assignmentId: string;
    filePath: string;
    content: string;
    sha?: string;
    onCommitSuccess: (sha: string) => void;
    mode: "save" | "submit";
}

export function CommitDialog({
    open,
    onOpenChange,
    assignmentId,
    filePath,
    content,
    sha,
    onCommitSuccess,
    mode,
}: CommitDialogProps) {
    const [message, setMessage] = useState("");
    const [isCommitting, setIsCommitting] = useState(false);

    const handleCommit = async () => {
        if (!message.trim()) {
            toast.error("Please enter a commit message");
            return;
        }

        try {
            setIsCommitting(true);
            const req: GitHubCommitRequest = {
                file_path: filePath,
                content,
                message,
                sha: sha || undefined,
            };

            const result = await githubApi.commitFile(assignmentId, req);
            if (result.success) {
                toast.success(mode === "submit" ? "Changes submitted!" : "Changes saved!");
                onCommitSuccess(result.sha);
                setMessage("");
                onOpenChange(false);
            } else {
                toast.error(result.message || "Failed to commit");
            }
        } catch (err) {
            console.error("Commit failed:", err);
            toast.error("Failed to commit changes");
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitCommit className="h-5 w-5" />
                        {mode === "submit" ? "Submit Assignment" : "Save Changes"}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "submit"
                            ? "This will create a submission version. Your work will be graded."
                            : "Commit your changes to the repository."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">File</label>
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded">{filePath}</p>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Commit Message</label>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={mode === "submit" ? "Final submission for assignment" : "Describe your changes..."}
                            rows={3}
                            className="mt-1"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCommitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleCommit} disabled={isCommitting || !message.trim()}>
                        {isCommitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Committing...
                            </>
                        ) : mode === "submit" ? (
                            "Submit"
                        ) : (
                            "Commit & Save"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}