"use client";

import { useState, useEffect } from "react";
import { FolderOpen, FileCode, File, ChevronRight, ChevronDown, Loader2, RefreshCw, GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { githubApi, type GitHubFile } from "@/lib/api/github";

interface FileExplorerProps {
    assignmentId: string;
    onFileSelect: (path: string, content: string, sha: string) => void;
    currentFilePath?: string;
    readOnly?: boolean;
}

interface TreeNode {
    name: string;
    path: string;
    type: "file" | "dir";
    sha?: string;
    children?: TreeNode[];
    isOpen?: boolean;
}

export function FileExplorer({ assignmentId, onFileSelect, currentFilePath, readOnly = false }: FileExplorerProps) {
    const [files, setFiles] = useState<TreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set([""]));
    const [fileCache, setFileCache] = useState<Map<string, { content: string; sha: string }>>(new Map());

    const transformToTree = (fileList: GitHubFile[]): TreeNode[] => {
        return fileList.map((file) => ({
            name: file.name,
            path: file.path,
            type: file.type === "dir" ? "dir" : "file",
            sha: file.sha,
        }));
    };

    const loadRootFiles = async () => {
        try {
            setLoading(true);
            setError(null);
            const fileList = await githubApi.getFiles(assignmentId, "");
            setFiles(transformToTree(fileList));
        } catch (err) {
            setError("Failed to load files");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRootFiles();
    }, [assignmentId]);

    const toggleDir = async (path: string) => {
        const newExpanded = new Set(expandedDirs);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedDirs(newExpanded);

        if (!fileCache.has(path)) {
            try {
                const fileList = await githubApi.getFiles(assignmentId, path);
                const node = findNode(files, path);
                if (node) {
                    node.children = transformToTree(fileList);
                    setFiles([...files]);
                }
            } catch (err) {
                console.error("Failed to load directory:", err);
            }
        }
    };

    const findNode = (nodes: TreeNode[], path: string): TreeNode | null => {
        for (const node of nodes) {
            if (node.path === path) return node;
            if (node.children) {
                const found = findNode(node.children, path);
                if (found) return found;
            }
        }
        return null;
    };

    const handleFileClick = async (node: TreeNode) => {
        if (node.type === "dir") {
            await toggleDir(node.path);
        } else {
            let cached = fileCache.get(node.path);
            if (!cached) {
                try {
                    const result = await githubApi.getFileContent(assignmentId, node.path);
                    cached = result;
                    setFileCache(new Map(fileCache).set(node.path, result));
                } catch (err) {
                    console.error("Failed to load file:", err);
                    return;
                }
            }
            onFileSelect(node.path, cached.content, cached.sha || "");
        }
    };

    const renderTree = (nodes: TreeNode[], depth: number = 0) => {
        return nodes.map((node) => {
            const isExpanded = expandedDirs.has(node.path);
            const isSelected = currentFilePath === node.path;
            const paddingLeft = depth * 16 + 8;

            if (node.type === "dir") {
                return (
                    <div key={node.path}>
                        <button
                            className={`flex items-center w-full text-left py-1 hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
                            style={{ paddingLeft }}
                            onClick={() => toggleDir(node.path)}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 mr-1 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 mr-1 text-muted-foreground" />
                            )}
                            <FolderOpen className="h-4 w-4 mr-2 text-yellow-500" />
                            <span className="text-sm truncate">{node.name}</span>
                        </button>
                        {isExpanded && node.children && (
                            <div>{renderTree(node.children, depth + 1)}</div>
                        )}
                    </div>
                );
            }

            return (
                <button
                    key={node.path}
                    className={`flex items-center w-full text-left py-1 hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
                    style={{ paddingLeft: paddingLeft + 20 }}
                    onClick={() => handleFileClick(node)}
                >
                    <FileCode className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="text-sm truncate">{node.name}</span>
                </button>
            );
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center">
                <p className="text-sm text-destructive mb-2">{error}</p>
                <Button variant="outline" size="sm" onClick={loadRootFiles}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-2 border-b">
                <span className="text-sm font-medium">Files</span>
                {!readOnly && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Plus className="h-4 w-4" />
                    </Button>
                )}
            </div>
            <div className="flex-1 overflow-auto p-2">
                {files.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No files yet. Create a file to get started.
                    </p>
                ) : (
                    renderTree(files)
                )}
            </div>
        </div>
    );
}