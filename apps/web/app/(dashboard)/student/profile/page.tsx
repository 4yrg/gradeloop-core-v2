"use client";

import * as React from "react";
import {
    User,
    Mail,
    Building2,
    Landmark,
    BadgeCheck,
    Calendar,
    Shield,
    IdCard,
    Camera,
    Loader2,
    AlertCircle,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { profileApi } from "@/lib/api/profile";
import type { UserProfile } from "@/types/profile.ts";

function getInitials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

interface ProfileFieldProps {
    icon: React.ReactNode;
    label: string;
    value?: string | null;
}

function ProfileField({ icon, label, value }: ProfileFieldProps) {
    return (
        <div className="flex items-start gap-3 py-3 border-b last:border-0 border-zinc-100 dark:border-zinc-800">
            <div className="mt-0.5 text-zinc-400 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
                <p className="text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {value ?? <span className="text-zinc-400 italic">Not set</span>}
                </p>
            </div>
        </div>
    );
}

export default function StudentProfilePage() {
    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        let cancelled = false;
        profileApi
            .getProfile()
            .then((p) => { if (!cancelled) setProfile(p); })
            .catch(() => toast.error("Failed to load profile."))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File too large. Maximum size is 5 MB.");
            return;
        }
        setUploadingAvatar(true);
        try {
            const res = await profileApi.updateAvatar(file);
            setProfile((prev) => prev ? { ...prev, avatar_url: res.avatar_url } : prev);
            toast.success("Profile picture updated.");
        } catch {
            toast.error("Failed to update profile picture.");
        } finally {
            setUploadingAvatar(false);
            // reset so same file can be re-selected
            e.target.value = "";
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-zinc-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading profile…
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-zinc-500">
                <AlertCircle className="h-8 w-8" />
                <p>Could not load your profile. Please refresh the page.</p>
            </div>
        );
    }

    const initials = getInitials(profile.full_name);

    return (
        <div className="max-w-3xl mx-auto space-y-6 py-2">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                    View your account information.
                </p>
            </div>

            {/* Avatar + name hero */}
            <Card className="shadow-sm">
                <CardContent className="pt-6 pb-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                        {/* Avatar with upload overlay */}
                        <div className="relative group shrink-0">
                            <Avatar className="h-24 w-24 border-2 border-zinc-200 dark:border-zinc-700">
                                {profile.avatar_url ? (
                                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                                ) : null}
                                <AvatarFallback className="text-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <button
                                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingAvatar}
                                title="Change profile picture"
                            >
                                {uploadingAvatar ? (
                                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                                ) : (
                                    <Camera className="h-5 w-5 text-white" />
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                        </div>

                        {/* Name & status */}
                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-xl font-semibold">{profile.full_name}</h2>
                            <p className="text-sm text-zinc-500 mt-0.5">{profile.email}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
                                <Badge variant="secondary" className="capitalize">
                                    {profile.role_name}
                                </Badge>
                                <Badge
                                    variant={profile.is_active ? "default" : "destructive"}
                                    className="capitalize"
                                >
                                    {profile.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {profile.user_type && (
                                    <Badge variant="outline" className="capitalize text-xs">
                                        {profile.user_type}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-3">
                                Click the avatar to change your profile picture (max 5 MB)
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Account Details */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Account Details</CardTitle>
                    <CardDescription>Your personal and institutional information</CardDescription>
                </CardHeader>
                <CardContent>
                    <ProfileField
                        icon={<User className="h-4 w-4" />}
                        label="Full Name"
                        value={profile.full_name}
                    />
                    <ProfileField
                        icon={<Mail className="h-4 w-4" />}
                        label="Email Address"
                        value={profile.email}
                    />
                    {profile.student_id && (
                        <ProfileField
                            icon={<IdCard className="h-4 w-4" />}
                            label="Student ID"
                            value={profile.student_id}
                        />
                    )}
                    {profile.designation && (
                        <ProfileField
                            icon={<BadgeCheck className="h-4 w-4" />}
                            label="Designation"
                            value={profile.designation}
                        />
                    )}
                    {profile.faculty && (
                        <ProfileField
                            icon={<Landmark className="h-4 w-4" />}
                            label="Faculty"
                            value={profile.faculty}
                        />
                    )}
                    {profile.department && (
                        <ProfileField
                            icon={<Building2 className="h-4 w-4" />}
                            label="Department"
                            value={profile.department}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Account metadata */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Account Metadata</CardTitle>
                    <CardDescription>System-level information about your account</CardDescription>
                </CardHeader>
                <CardContent>
                    <ProfileField
                        icon={<Shield className="h-4 w-4" />}
                        label="Account ID"
                        value={profile.id}
                    />
                    <ProfileField
                        icon={<Calendar className="h-4 w-4" />}
                        label="Member Since"
                        value={formatDate(profile.created_at)}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
