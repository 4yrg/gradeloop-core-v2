"use client";

/**
 * KeystrokeEnrollmentPrompt
 *
 * Shown once per student login if they haven't enrolled in keystroke
 * biometrics. Checks /api/keystroke/enroll/progress/{userId} and renders
 * a dialog with:
 *   • "Enroll Now"  → /student/keystroke-enrollment
 *   • "Later"       → persists dismissal; profile page shows a reminder banner
 *
 * Silently no-ops for non-student roles or if the keystroke service is down.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, ShieldCheck, Clock } from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";
import { useKeystrokeEnrollmentStore } from "@/lib/stores/keystrokeEnrollmentStore";
import { keystrokeApi } from "@/lib/api/keystroke";

export function KeystrokeEnrollmentPrompt() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const isHydrated = useAuthStore((s) => s.isHydrated);

    const { dismiss, setEnrolled, isDismissed, isEnrolled } =
        useKeystrokeEnrollmentStore();

    const [open, setOpen] = React.useState(false);
    const [checked, setChecked] = React.useState(false);

    // Only run for students after auth is ready
    React.useEffect(() => {
        if (!isHydrated || !user || user.user_type !== "student" || checked) return;
        setChecked(true);

        // Already known enrolled → nothing to do
        if (isEnrolled(user.id)) return;

        // Already dismissed this session-cycle → nothing to do
        if (isDismissed(user.id)) return;

        // Check from service
        keystrokeApi
            .getEnrollmentProgress(user.id)
            .then((progress) => {
                const allDone = progress.enrollment_complete;
                if (allDone) {
                    setEnrolled(user.id, true);
                } else {
                    setOpen(true);
                }
            })
            .catch(() => {
                // Keystroke service unavailable — silently skip
            });
    }, [isHydrated, user, checked, isEnrolled, isDismissed, setEnrolled]);

    const handleEnrollNow = () => {
        setOpen(false);
        router.push("/student/keystroke-enrollment");
    };

    const handleLater = () => {
        if (user) dismiss(user.id);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleLater(); }}>
            <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                        <Fingerprint className="h-7 w-7 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-xl">
                        Set Up Keystroke Security
                    </DialogTitle>
                    <DialogDescription className="text-center leading-relaxed">
                        GradeLoop uses keystroke biometrics to verify your identity
                        during assignments. Enrolment takes less than&nbsp;5&nbsp;minutes
                        and significantly improves academic integrity monitoring.
                    </DialogDescription>
                </DialogHeader>

                {/* Feature highlights */}
                <div className="my-2 space-y-2.5">
                    {[
                        {
                            icon: ShieldCheck,
                            title: "Continuous identity verification",
                            desc: "Confirms it's really you throughout the assignment",
                        },
                        {
                            icon: Fingerprint,
                            title: "Stress-aware recognition",
                            desc: "Works even when you're typing under pressure",
                        },
                        {
                            icon: Clock,
                            title: "One-time setup",
                            desc: "Enrol once, protected on every future submission",
                        },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div
                            key={title}
                            className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5"
                        >
                            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                            <div>
                                <p className="text-sm font-semibold leading-tight">{title}</p>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                    <Button className="w-full" onClick={handleEnrollNow}>
                        <Fingerprint className="mr-2 h-4 w-4" />
                        Enroll Now
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full text-muted-foreground"
                        onClick={handleLater}
                    >
                        Later — remind me from my profile
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
