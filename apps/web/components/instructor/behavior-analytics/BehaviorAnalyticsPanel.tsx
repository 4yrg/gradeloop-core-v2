"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    AlertTriangle,
    Brain,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Info,
    ShieldCheck,
    TrendingUp,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsData, BehavioralAnalysis } from "@/lib/api/keystroke";
import { ProcessScoreGauge } from "./ProcessScoreGauge";
import { RiskTimelineChart } from "./RiskTimelineChart";
import { CognitiveLoadChart } from "./CognitiveLoadChart";
import { FrictionPointHeatmap } from "./FrictionPointHeatmap";
import { useState } from "react";

interface BehaviorAnalyticsPanelProps {
    data: AnalyticsData;
}

// ─── Utility sub-components ───────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm">{title}</h3>
        </div>
    );
}

function SummaryCard({
    label,
    value,
    sub,
    variant = "default",
}: {
    label: string;
    value: React.ReactNode;
    sub?: string;
    variant?: "default" | "success" | "warning" | "danger";
}) {
    const colors: Record<typeof variant, string> = {
        default: "border-border",
        success: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20",
        warning: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
        danger: "border-red-400 bg-red-50 dark:bg-red-950/20",
    };
    return (
        <div className={cn("rounded-xl border p-4 text-center", colors[variant])}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                {label}
            </p>
            <p className="text-2xl font-black tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    );
}

function Accordion({
    title,
    children,
    defaultOpen = false,
}: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-border overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/30 transition-colors"
            >
                <span>{title}</span>
                {open ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
            </button>
            {open && <div className="px-4 pb-4 pt-1">{children}</div>}
        </div>
    );
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-center py-1 border-b border-border/40 last:border-0 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
        </div>
    );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function BehaviorAnalyticsPanel({ data }: BehaviorAnalyticsPanelProps) {
    if (!data.analysis_available || !data.behavioral_analysis) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Info className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Behavioral analysis not available</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                    The session may not have had enough keystroke data (minimum 10 events
                    required) or the analysis engine encountered an error.
                </p>
            </div>
        );
    }

    const ba: BehavioralAnalysis = data.behavioral_analysis;
    const sm = ba.session_metrics;
    const ai = ba.authenticity_indicators;
    const ca = ba.cognitive_analysis;
    const ps = ba.process_score;

    const contributorPct = Math.round(ai.multiple_contributor_probability * 100);
    const humanPct = Math.round(ai.human_signature_score);
    const syntheticPct = Math.round(ai.synthetic_signature_score);
    const overallScore = Math.round(ps.overall_score);

    const overallVariant =
        overallScore >= 75 ? "success" : overallScore >= 50 ? "warning" : "danger";

    // Derive LLM narrative text (may arrive in various shapes)
    const llm = ba.llm_insights ?? {};
    const narrativeText: string =
        (typeof llm.narrative === "string" && llm.narrative) ||
        (typeof llm.summary === "string" && llm.summary) ||
        (typeof llm.feedback === "string" && llm.feedback) ||
        "";

    const recommendations: string[] =
        Array.isArray(llm.recommendations) ? llm.recommendations as string[] : [];

    return (
        <div className="space-y-6">
            {/* ── 1. Summary cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                    label="Overall score"
                    value={`${overallScore}`}
                    sub={`/ 100 · ${ps.confidence_level}`}
                    variant={overallVariant}
                />
                <SummaryCard
                    label="Authenticity"
                    value={`${Math.round(ps.authenticity_score)}`}
                    sub="/ 100"
                    variant={ps.authenticity_score >= 60 ? "success" : "danger"}
                />
                <SummaryCard
                    label="Engagement"
                    value={`${Math.round(ps.engagement_score)}`}
                    sub="/ 100"
                />
                <SummaryCard
                    label="Multiple contributors"
                    value={`${contributorPct}%`}
                    sub="probability"
                    variant={contributorPct > 40 ? "danger" : contributorPct > 20 ? "warning" : "success"}
                />
            </div>

            {/* ── 2. Process score gauges ────────────────────────────────────── */}
            <div className="rounded-xl border border-border p-4">
                <SectionHeader icon={TrendingUp} title="Process Scores" />
                <div className="flex justify-around flex-wrap gap-4">
                    <ProcessScoreGauge label="Active problem solving" value={ps.active_problem_solving_score} />
                    <ProcessScoreGauge label="Learning depth" value={ps.learning_depth_score} />
                    <ProcessScoreGauge label="Authenticity" value={ps.authenticity_score} />
                    <ProcessScoreGauge label="Engagement" value={ps.engagement_score} />
                    <ProcessScoreGauge label="Overall" value={ps.overall_score} size={110} />
                </div>
            </div>

            {/* ── 3. Risk & similarity timeline ─────────────────────────────── */}
            <div className="rounded-xl border border-border p-4">
                <SectionHeader icon={ShieldCheck} title="Auth Confidence Over Time" />
                <RiskTimelineChart data={data.risk_timeline} />
            </div>

            {/* ── 4. Cognitive load ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-border p-4">
                <SectionHeader icon={Brain} title="Cognitive Load Over Time" />
                <p className="text-xs text-muted-foreground mb-3">
                    Estimated from deletion rate and pause frequency per 50-keystroke window.
                    Style:{" "}
                    <Badge variant="secondary" className="text-[11px]">
                        {ca.troubleshooting_style}
                    </Badge>
                </p>
                <CognitiveLoadChart data={ca.cognitive_load_timeline} />
            </div>

            {/* ── 5. Friction point heatmap ──────────────────────────────────── */}
            <div className="rounded-xl border border-border p-4">
                <SectionHeader icon={AlertTriangle} title="Friction Point Heatmap" />
                <p className="text-xs text-muted-foreground mb-3">
                    Moments with high deletion rate or long pauses — areas where the student
                    struggled.
                </p>
                <FrictionPointHeatmap
                    frictionPoints={data.friction_points}
                    durationSeconds={sm.total_duration}
                />
            </div>

            {/* ── 6. Authenticity indicators ────────────────────────────────── */}
            <div className="rounded-xl border border-border p-4">
                <SectionHeader icon={ShieldCheck} title="Authenticity Indicators" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    <SummaryCard label="Human signature" value={`${humanPct}%`} variant={humanPct >= 60 ? "success" : "warning"} />
                    <SummaryCard label="Synthetic signature" value={`${syntheticPct}%`} variant={syntheticPct <= 30 ? "success" : "danger"} />
                    <SummaryCard
                        label="Ext. assistance prob."
                        value={`${Math.round(ai.external_assistance_probability * 100)}%`}
                        variant={ai.external_assistance_probability <= 0.3 ? "success" : "danger"}
                    />
                </div>

                {ai.anomaly_flags.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Anomaly flags
                        </p>
                        {ai.anomaly_flags.map((flag, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 px-3 py-2 text-xs"
                            >
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                                <span>{typeof flag === "string" ? flag : JSON.stringify(flag)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── 7. Critical anomalies ─────────────────────────────────────── */}
            {ba.critical_anomalies.length > 0 && (
                <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
                    <SectionHeader icon={AlertTriangle} title="Critical Anomalies" />
                    <div className="space-y-2">
                        {ba.critical_anomalies.map((anomaly, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>{anomaly}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── 8. Multiple contributor probability ───────────────────────── */}
            {contributorPct > 25 && (
                <div className="rounded-xl border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-yellow-600" />
                        <span className="font-semibold text-sm text-yellow-700 dark:text-yellow-400">
                            Multiple contributors possible ({contributorPct}%)
                        </span>
                    </div>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        The biometric typing patterns show significant variation that may
                        indicate more than one person typed this code.
                    </p>
                </div>
            )}

            {/* ── 9. LLM pedagogical narrative ──────────────────────────────── */}
            {(narrativeText || recommendations.length > 0) && (
                <div className="rounded-xl border border-border p-4">
                    <SectionHeader icon={CheckCircle2} title="Pedagogical Insights" />
                    {narrativeText && (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm mb-3">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {narrativeText}
                            </ReactMarkdown>
                        </div>
                    )}
                    {recommendations.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Recommendations
                            </p>
                            {recommendations.map((rec, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>{rec}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── 10. Raw session metrics ───────────────────────────────────── */}
            <Accordion title="Raw session metrics">
                <div className="space-y-0.5">
                    <MetricRow label="Duration" value={`${sm.total_duration}s`} />
                    <MetricRow label="Total keystrokes" value={sm.total_keystrokes.toLocaleString()} />
                    <MetricRow label="Typing speed" value={`${sm.average_typing_speed.toFixed(0)} CPM`} />
                    <MetricRow label="Pause count" value={sm.pause_count} />
                    <MetricRow label="Long pauses (>3s)" value={sm.long_pause_count} />
                    <MetricRow label="Deletion count" value={sm.deletion_count} />
                    <MetricRow label="Deletion rate" value={`${(sm.deletion_rate * 100).toFixed(1)}%`} />
                    <MetricRow label="Paste events" value={sm.paste_count} />
                    <MetricRow label="Copy events" value={sm.copy_count} />
                    <MetricRow label="Avg dwell time" value={`${sm.avg_dwell_time.toFixed(0)} ms`} />
                    <MetricRow label="Avg flight time" value={`${sm.avg_flight_time.toFixed(0)} ms`} />
                    <MetricRow label="Burst typing events" value={sm.burst_typing_events} />
                    <MetricRow label="Rhythm consistency" value={`${(sm.rhythm_consistency * 100).toFixed(1)}%`} />
                    <MetricRow label="Friction points" value={sm.friction_points.length} />
                </div>
            </Accordion>

            {/* ── 11. Mastery & struggle indicators ────────────────────────── */}
            {(ca.mastery_indicators.length > 0 || ca.high_friction_concepts.length > 0) && (
                <Accordion title="Mastery & struggle indicators" defaultOpen>
                    {ca.mastery_indicators.length > 0 && (
                        <div className="mb-3">
                            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                                Mastery signs
                            </p>
                            {ca.mastery_indicators.map((m, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    {m}
                                </div>
                            ))}
                        </div>
                    )}
                    {ca.high_friction_concepts.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">
                                High friction areas
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {ca.high_friction_concepts.map((c, i) => (
                                    <Badge key={i} variant="outline" className="text-xs border-orange-300 text-orange-700 dark:text-orange-400">
                                        {c}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </Accordion>
            )}
        </div>
    );
}
