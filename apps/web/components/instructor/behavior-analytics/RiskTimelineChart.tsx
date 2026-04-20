"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
    Legend,
} from "recharts";
import type { RiskTimelinePoint } from "@/lib/api/keystroke";

interface RiskTimelineChartProps {
    data: RiskTimelinePoint[];
}

function formatSec(v: number): string {
    const m = Math.floor(v / 60);
    const s = v % 60;
    return m > 0 ? `${m}m${String(s).padStart(2, "0")}s` : `${s}s`;
}

export function RiskTimelineChart({ data }: RiskTimelineChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No authentication events recorded.
            </div>
        );
    }

    const chartData = data.map((p) => ({
        time: p.offset_seconds,
        risk: +(p.risk_score * 100).toFixed(1),
        similarity: +(p.similarity_score * 100).toFixed(1),
        anomaly: p.is_anomaly,
    }));

    return (
        <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis
                    dataKey="time"
                    tickFormatter={formatSec}
                    tick={{ fontSize: 11 }}
                    label={{ value: "Time", position: "insideBottomRight", offset: -4, fontSize: 11 }}
                />
                <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                    width={40}
                />
                <Tooltip
                    formatter={(value, name) => [`${Number(value).toFixed(0)}%`, name === "risk" ? "Risk" : "Similarity"] as [string, string]}
                    labelFormatter={(v) => `At ${formatSec(v as number)}`}
                />
                <Legend
                    formatter={(value) => (value === "risk" ? "Risk score" : "Similarity")}
                />
                {/* Safe zone (≤30% risk) */}
                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Safe", fontSize: 10, fill: "#22c55e" }} />
                {/* Suspicious threshold (50%) */}
                <ReferenceLine y={50} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Suspicious", fontSize: 10, fill: "#f97316" }} />

                <Line
                    type="monotone"
                    dataKey="risk"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={(props) => {
                        const { payload, cx, cy } = props as { payload: typeof chartData[0]; cx: number; cy: number };
                        if (!payload.anomaly) return <React.Fragment key={props.key} />;
                        return (
                            <circle
                                key={props.key}
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill="#ef4444"
                                stroke="#fff"
                                strokeWidth={1.5}
                            />
                        );
                    }}
                    activeDot={{ r: 4 }}
                />
                <Line
                    type="monotone"
                    dataKey="similarity"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

import React from "react";
