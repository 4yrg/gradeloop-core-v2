'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  AlertTriangle,
  ChevronRight,
  CalendarDays,
  Settings,
  Save,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { semestersApi } from '@/lib/api/academics';
import { useUIStore } from '@/lib/stores/uiStore';
import { handleApiError } from '@/lib/api/axios';
import { useAcademicsAccess } from '@/lib/hooks/useAcademicsAccess';
import { toast } from '@/lib/hooks/use-toast';
import { AcademicsDetailLayout } from '@/components/admin/academics/AcademicsDetailLayout';
import { DangerZone } from '@/components/admin/academics/DangerZone';
import { SEMESTER_TERM_TYPES, SEMESTER_STATUSES } from '@/types/academics.types';
import type { Semester, UpdateSemesterRequest } from '@/types/academics.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtInputDate(iso: string) {
  return iso.split('T')[0]; // Returns YYYY-MM-DD format for input[type="date"]
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  Planned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  Completed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SemesterDetailPage() {
  const router = useRouter();
  const params = useParams<{ semesterId: string }>();
  const { canAccess } = useAcademicsAccess();

  const setPageTitle = useUIStore((s) => s.setPageTitle);

  const [semester, setSemester] = React.useState<Semester | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Settings
  const [activeTab, setActiveTab] = React.useState<'overview' | 'instances' | 'settings'>('overview');
  const [editValues, setEditValues] = React.useState<UpdateSemesterRequest>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!canAccess) router.replace('/admin');
  }, [canAccess, router]);

  const load = React.useCallback(async () => {
    if (!params.semesterId) return;
    setLoading(true);
    setError(null);
    try {
      const sem = await semestersApi.get(params.semesterId);
      setSemester(sem);
      setPageTitle(sem.name);
      setEditValues({
        name: sem.name,
        term_type: sem.term_type,
        start_date: sem.start_date,
        end_date: sem.end_date,
        status: sem.status,
      });
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [params.semesterId, setPageTitle]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => () => setPageTitle(null), [setPageTitle]);

  async function handleSaveSemester(e: React.FormEvent) {
    e.preventDefault();
    if (!semester) return;
    setSaving(true);
    try {
      const updated = await semestersApi.update(semester.id, editValues);
      setSemester(updated);
      setPageTitle(updated.name);
      toast.success('Semester updated', updated.name);
    } catch (err) {
      toast.error('Update failed', handleApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!canAccess) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <Link href="/admin/academics" className="hover:text-foreground transition-colors">Academics</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <Link href="/admin/academics/semesters" className="hover:text-foreground transition-colors">Semesters</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground font-medium">
          {semester?.name ?? 'Loading...'}
        </span>
      </nav>

      {loading && <HeaderSkeleton />}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Failed to load semester</p>
            <p className="opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Header */}
      {!loading && semester && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -ml-1"
                  onClick={() => router.push('/admin/academics/semesters')}
                  title="Back to Semesters"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {semester.name}
                </h1>
              </div>
              <div className="flex items-center gap-2 ml-9">
                <p className="text-sm font-mono text-muted-foreground">{semester.code}</p>
                <Badge className={`border-0 ${STATUS_COLOR[semester.status] || ''}`}>
                  {semester.status}
                </Badge>
              </div>
            </div>
            <Button
              onClick={load}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Semester
                </div>
                <p className="text-lg font-bold text-foreground">{semester.name}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Duration
                </div>
                <p className="text-sm font-medium text-foreground">
                  {fmt(semester.start_date)} — {fmt(semester.end_date)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  <Badge variant="outline" className="text-xs">{semester.term_type}</Badge>
                </div>
                <Badge variant={semester.is_active ? 'success' : 'secondary'} className="text-sm px-2.5 py-0.5">
                  {semester.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tabbed Content */}
      {!loading && semester && (
        <AcademicsDetailLayout
          tabs={[
            { id: 'overview', label: 'Overview', icon: Calendar },
            { id: 'instances', label: 'Course Instances', icon: BookOpen },
            { id: 'settings', label: 'Settings', icon: Settings },
          ]}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as typeof activeTab)}
        >
          {activeTab === 'overview' && (
            <Card className="shadow-sm border-border">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="text-base font-bold">Semester Information</CardTitle>
                <CardDescription className="text-xs">
                  Core details about this academic semester.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Semester Name</Label>
                    <p className="text-sm font-medium text-foreground">{semester.name}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Semester Code</Label>
                    <p className="text-sm font-mono font-medium text-foreground bg-muted px-2 py-1 rounded w-fit">{semester.code}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Term Type</Label>
                    <p className="text-sm font-medium text-foreground">
                      <Badge variant="outline">{semester.term_type}</Badge>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
                    <div>
                      <Badge className={`${STATUS_COLOR[semester.status] || ''} border-0`}>
                        {semester.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Start Date</Label>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmt(semester.start_date)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">End Date</Label>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmt(semester.end_date)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Active Status</Label>
                    <div>
                      <Badge variant={semester.is_active ? 'success' : 'secondary'} className="text-sm">
                        {semester.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Last Updated</Label>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmt(semester.updated_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'instances' && (
            <Card className="shadow-sm border-border">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="text-base font-bold">Course Instances</CardTitle>
                <CardDescription className="text-xs">Course offerings scheduled in this semester.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium text-muted-foreground text-sm mb-2">Course instances coming soon</p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    The academic service API does not currently expose course instances filtered by semester.
                    This feature will be available when the endpoint is implemented.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="border-border">
                <CardHeader className="border-b border-border bg-muted/30">
                  <CardTitle className="text-base font-bold">General Settings</CardTitle>
                  <CardDescription className="text-xs">Update semester details and schedule.</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSaveSemester} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="sem_name" className="text-xs font-bold uppercase text-muted-foreground">Semester Name</Label>
                        <Input
                          id="sem_name"
                          className="font-medium"
                          value={editValues.name ?? ''}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sem_code" className="text-xs font-bold uppercase text-muted-foreground">Semester Code</Label>
                        <Input
                          id="sem_code"
                          className="font-mono"
                          value={semester.code}
                          disabled
                        />
                        <p className="text-[10px] text-muted-foreground">Code cannot be changed after creation</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="term_type" className="text-xs font-bold uppercase text-muted-foreground">Term Type</Label>
                        <Select
                          value={editValues.term_type ?? semester.term_type}
                          onValueChange={(v) => setEditValues({ ...editValues, term_type: v as typeof semester.term_type })}
                        >
                          <SelectTrigger id="term_type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEMESTER_TERM_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status" className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
                        <Select
                          value={editValues.status ?? semester.status}
                          onValueChange={(v) => setEditValues({ ...editValues, status: v as typeof semester.status })}
                        >
                          <SelectTrigger id="status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEMESTER_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="start_date" className="text-xs font-bold uppercase text-muted-foreground">Start Date</Label>
                        <Input
                          id="start_date"
                          type="date"
                          value={editValues.start_date ? fmtInputDate(editValues.start_date) : ''}
                          onChange={(e) => setEditValues({ ...editValues, start_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_date" className="text-xs font-bold uppercase text-muted-foreground">End Date</Label>
                        <Input
                          id="end_date"
                          type="date"
                          value={editValues.end_date ? fmtInputDate(editValues.end_date) : ''}
                          onChange={(e) => setEditValues({ ...editValues, end_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button disabled={saving} className="font-bold gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <DangerZone
                entityName={semester.name}
                entityType="semester"
                isActive={semester.is_active}
                onDeactivate={async () => {
                  await semestersApi.deactivate(semester.id);
                  setSemester((prev) => prev ? { ...prev, is_active: false } : prev);
                  toast.success('Semester deactivated', semester.name);
                }}
                onReactivate={async () => {
                  await semestersApi.reactivate(semester.id);
                  setSemester((prev) => prev ? { ...prev, is_active: true } : prev);
                  toast.success('Semester reactivated', semester.name);
                }}
                showDelete={true}
                onDelete={async () => {
                  await semestersApi.delete(semester.id);
                  toast.success('Semester deleted', semester.name);
                  router.push('/admin/academics/semesters');
                }}
                deleteDescription={`This will permanently mark "${semester.name}" as inactive. The semester and all its data will be preserved but unavailable for use.`}
              />
            </div>
          )}
        </AcademicsDetailLayout>
      )}
    </div>
  );
}
