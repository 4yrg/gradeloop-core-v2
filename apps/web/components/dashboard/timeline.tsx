import { Progress } from "@/components/ui/progress"

export function Timeline() {
    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium tracking-tight">Semester Progress</h3>

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm p-6 space-y-6">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Current Semester</span>
                        <span className="text-muted-foreground">Week 8 of 14</span>
                    </div>
                    <Progress value={60} className="h-2 bg-secondary" />
                    <p className="text-xs text-muted-foreground pt-1">Mid-term exams completed. Finals start in 6 weeks.</p>
                </div>

                <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(76,91,212,0.6)]" />
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium">Assignment Grading</span>
                                    <span className="text-xs text-muted-foreground">85%</span>
                                </div>
                                <Progress value={85} className="h-1.5 bg-secondary" />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(91,192,235,0.6)]" />
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium">Viva Sessions</span>
                                    <span className="text-xs text-muted-foreground">30%</span>
                                </div>
                                <Progress value={30} className="h-1.5 bg-secondary" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex gap-4 items-start">
                <div className="w-1.5 h-12 bg-indigo-500 rounded-full mt-1 shrink-0" />
                <div>
                    <h4 className="font-medium text-indigo-400 text-sm mb-1">AI Insight</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Based on recent submissions, 15% of students are struggling with <span className="text-foreground font-medium">Graph Algorithms</span>. Consider scheduling a review session.
                    </p>
                </div>
            </div>
        </div>
    )
}
