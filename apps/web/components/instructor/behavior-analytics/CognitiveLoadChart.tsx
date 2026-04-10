"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import type { CognitiveLoadPoint } from "@/lib/api/keystroke";

interface CognitiveLoadChartProps {
    data: CognitiveLoadPoint[];
}

function formatSec(v: number): string {
    const m = Math.floor(v / 60);
    const s = Math.round(v % 60);
    return m > 0 ? `${m}m${String(s).padStart(2, "0")}s` : `${s}s`;
}

export function CognitiveLoadChart({ data }: CognitiveLoadChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No cognitive load data available.
            </div>
        );
    }

    const chartData = data.map((p) => ({
        time: p.timestamp,
        load: +(p.load * 100).toFixed(1),
    }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="cogLoadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
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
                    formatter={(v) => [`${Number(v).toFixed(0)}%`, "Cognitive load"] as [string, string]}
                    labelFormatter={(v) => `At ${formatSec(v as number)}`}
                />
                {/* Medium load reference */}
                <ReferenceLine
                    y={50}
                    stroke="#eab308"
                    strokeDasharray="4 2"
                    strokeWidth={1}
                    label={{ value: "Moderate", fontSize: 10, fill: "#eab308" }}
                />
                <Area
                    type="monotone"
                    dataKey="load"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#cogLoadGradient)"
                    dot={false}
                    activeDot={{ r: 4 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
