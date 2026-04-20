"use client";

interface GaugeProps {
    label: string;
    value: number;   // 0 – 100
    size?: number;   // svg diameter in px
}

function scoreColor(v: number): string {
    if (v >= 75) return "#22c55e"; // green-500
    if (v >= 50) return "#eab308"; // yellow-500
    return "#ef4444"; // red-500
}

export function ProcessScoreGauge({ label, value, size = 100 }: GaugeProps) {
    const r = (size - 12) / 2;
    const cx = size / 2;
    const cy = size / 2;

    // Arc spans 240° (from 150° to 30°, clockwise through bottom)
    const startAngle = 150;
    const totalArc = 240;
    const fillArc = (Math.min(100, Math.max(0, value)) / 100) * totalArc;

    function polarToCartesian(angleDeg: number) {
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        return {
            x: cx + r * Math.cos(rad),
            y: cy + r * Math.sin(rad),
        };
    }

    function arcPath(startDeg: number, endDeg: number) {
        const s = polarToCartesian(startDeg);
        const e = polarToCartesian(endDeg);
        const largeArc = endDeg - startDeg > 180 ? 1 : 0;
        return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
    }

    const color = scoreColor(value);

    return (
        <div className="flex flex-col items-center gap-1">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background arc */}
                <path
                    d={arcPath(startAngle, startAngle + totalArc)}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeWidth={8}
                    strokeLinecap="round"
                />
                {/* Value arc */}
                {fillArc > 0 && (
                    <path
                        d={arcPath(startAngle, startAngle + fillArc)}
                        fill="none"
                        stroke={color}
                        strokeWidth={8}
                        strokeLinecap="round"
                    />
                )}
                {/* Center text */}
                <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fontSize={size * 0.2}
                    fontWeight="bold"
                    fill={color}
                >
                    {Math.round(value)}
                </text>
            </svg>
            <p className="text-[11px] font-medium text-center text-muted-foreground leading-tight max-w-[80px]">
                {label}
            </p>
        </div>
    );
}
