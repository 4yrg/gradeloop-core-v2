"use client";

import * as React from "react";
import {
  User as UserIcon,
  Mail,
  ShieldCheck,
  School,
  Building2,
  Hash,
  Briefcase,
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AvatarUpload } from "./avatar-upload";
import { ProfileField } from "./profile-field";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useKeystrokeEnrollmentStore } from "@/lib/stores/keystrokeEnrollmentStore";
import { useAuthStore } from "@/lib/stores/authStore";
import { keystrokeApi } from "@/lib/api/keystroke";
import { KeystrokeAuthTestDialog } from "@/components/keystroke/keystroke-auth-test-dialog";
import type { UserProfile } from "@/types/profile";

interface ProfileCardProps {
  initialData: UserProfile;
}

export function ProfileCard({ initialData }: ProfileCardProps) {
  const [profile, setProfile] = React.useState<UserProfile>(initialData);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { setEnrolled } = useKeystrokeEnrollmentStore();
  const isStudent = profile.user_type === "student";

  // Live enrollment state fetched from API — not relying on cached store
  const [phasesComplete, setPhasesComplete] = React.useState<string[]>([]);
  const [phasesRemaining, setPhasesRemaining] = React.useState<string[]>([]);
  const [enrollmentComplete, setEnrollmentComplete] = React.useState(false);
  const [loadingEnrollment, setLoadingEnrollment] = React.useState(true);
  const [authTestOpen, setAuthTestOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isHydrated || !user || !isStudent) {
      setLoadingEnrollment(false);
      return;
    }
    keystrokeApi
      .getEnrollmentProgress(user.id)
      .then((data) => {
        const complete = data.phases_complete ?? [];
        const remaining = data.phases_remaining ?? [];
        const allDone = data.enrollment_complete;
        setPhasesComplete(complete);
        setPhasesRemaining(remaining);
        setEnrollmentComplete(allDone);
        if (allDone) setEnrolled(user.id, true);
      })
      .catch(() => {
        // Service unavailable — leave as not-enrolled
      })
      .finally(() => setLoadingEnrollment(false));
  }, [isHydrated, user, isStudent, setEnrolled]);

  const TOTAL_PHASES = phasesComplete.length + phasesRemaining.length || 1;
  const ALL_PHASES = [...phasesComplete, ...phasesRemaining];
  const PHASE_LABELS: Record<string, string> = {
    baseline: "Baseline",
    transcription: "Transcription",
    stress: "Stress",
    cognitive: "Cognitive",
  };

  const handleAvatarSuccess = (newUrl: string) => {
    setProfile((prev) => ({ ...prev, avatar_url: newUrl }));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <AvatarUpload
          currentAvatar={profile.avatar_url}
          name={profile.full_name || profile.email}
          onSuccess={handleAvatarSuccess}
        />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {profile.full_name || profile.email}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium capitalize">
            {profile.user_type} •{" "}
            {profile.user_type === "instructor" ? profile.designation : "Student"}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-zinc-200/60 shadow-xl shadow-zinc-200/20 dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:shadow-none backdrop-blur-sm">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-indigo-600 rounded-full" />
            <div>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>
                Basic account details retrieved from IAM service
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid gap-8 md:grid-cols-2">
            <ProfileField
              label="Full Name"
              value={profile.full_name}
              icon={UserIcon}
            />
            <ProfileField
              label="Email Address"
              value={profile.email}
              icon={Mail}
            />
            <ProfileField
              label="Account Type"
              value={profile.user_type}
              icon={ShieldCheck}
            />
          </div>

          <Separator className="my-10 bg-zinc-100 dark:bg-zinc-800" />

          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-1 bg-purple-600 rounded-full" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Academic & Professional
            </h3>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <ProfileField
              label="Faculty"
              value={profile.faculty}
              icon={School}
            />
            <ProfileField
              label="Department"
              value={profile.department}
              icon={Building2}
            />

            {profile.user_type === "student" ? (
              <ProfileField
                label="Student ID"
                value={profile.student_id}
                icon={Hash}
              />
            ) : (
              <ProfileField
                label="Designation"
                value={profile.designation}
                icon={Briefcase}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Keystroke Security Section (students only) ───────────────── */}
      {isStudent && (
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-indigo-600 rounded-full" />
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-indigo-600" />
                  Keystroke Security
                </CardTitle>
                <CardDescription>
                  Biometric identity verification during assignments
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Enrollment phases</span>
                <span className={`tabular-nums font-semibold ${
                  enrollmentComplete
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
                }`}>
                  {loadingEnrollment ? "…" : `${phasesComplete.length} / ${TOTAL_PHASES}`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    enrollmentComplete ? "bg-emerald-500" : "bg-primary"
                  }`}
                  style={{
                    width: loadingEnrollment
                      ? "0%"
                      : `${(phasesComplete.length / TOTAL_PHASES) * 100}%`,
                  }}
                />
              </div>
              {/* Phase chips */}
              {!loadingEnrollment && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ALL_PHASES.map((p) => {
                    const done = phasesComplete.includes(p);
                    return (
                      <span
                        key={p}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          done
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <span className="h-3 w-3 rounded-full border border-current opacity-40 inline-block" />
                        )}
                        {PHASE_LABELS[p]}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status banner */}
            {!loadingEnrollment && (
              enrollmentComplete ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Fully Enrolled</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-500">
                      All {TOTAL_PHASES} phases complete — your keystroke profile is active.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                    onClick={() => setAuthTestOpen(true)}
                  >
                    <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                    Test Auth
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                        {phasesComplete.length === 0 ? "Not Enrolled" : "Enrollment Incomplete"}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-500">
                        {phasesComplete.length === 0
                          ? `Complete all ${TOTAL_PHASES} phases to activate keystroke identity verification.`
                          : `${TOTAL_PHASES - phasesComplete.length} phase${TOTAL_PHASES - phasesComplete.length > 1 ? "s" : ""} remaining — continue to finish enrollment.`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => router.push("/student/keystroke-enrollment")}
                  >
                    <Fingerprint className="mr-1.5 h-3.5 w-3.5" />
                    {phasesComplete.length === 0 ? "Enroll Now" : "Continue"}
                  </Button>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      <div className="rounded-2xl border border-amber-200/50 bg-amber-50/30 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
        <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed text-center">
          <strong>Note:</strong> Some profile details are managed by the
          administration. To update your name, role, or faculty information,
          please contact the Registrar's Office or Human Resources department.
        </p>
      </div>

      <KeystrokeAuthTestDialog
        open={authTestOpen}
        onClose={() => setAuthTestOpen(false)}
      />
    </div>
  );
}
