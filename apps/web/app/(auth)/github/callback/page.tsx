"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function GitHubCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Processing GitHub authentication...");

    useEffect(() => {
        const code = searchParams.get("code");
        const error = searchParams.get("error");

        if (error) {
            setStatus("error");
            setMessage(`Authorization failed: ${error}`);
            return;
        }

        if (code) {
            handleOAuthCallback(code);
        } else {
            setStatus("error");
            setMessage("No authorization code received");
        }
    }, [searchParams]);

    const handleOAuthCallback = async (code: string) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/auth/github/callback?code=${code}`, {
                method: "GET",
                credentials: "include",
            });

            if (response.ok) {
                setStatus("success");
                setMessage("GitHub account linked successfully!");

                setTimeout(() => {
                    router.push("/dashboard");
                }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to link GitHub account. Please try again.");
            }
        } catch (err) {
            setStatus("error");
            setMessage("An error occurred during authentication.");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        {status === "loading" && (
                            <>
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-lg font-medium">{message}</p>
                            </>
                        )}

                        {status === "success" && (
                            <>
                                <CheckCircle className="h-12 w-12 text-green-500" />
                                <p className="text-lg font-medium">{message}</p>
                                <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
                            </>
                        )}

                        {status === "error" && (
                            <>
                                <XCircle className="h-12 w-12 text-destructive" />
                                <p className="text-lg font-medium">{message}</p>
                                <button
                                    onClick={() => router.push("/login")}
                                    className="text-sm text-primary hover:underline"
                                >
                                    Return to login
                                </button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}