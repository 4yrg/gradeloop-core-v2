import { BookOpen, FileText, Upload, Mic } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const stats = [
    {
        title: "Active Courses",
        value: "4",
        icon: BookOpen,
        description: "2 lectures today",
        change: "+1 new",
        changeType: "neutral", // neutral, positive, negative
        color: "text-primary",
        bg: "bg-primary/10",
    },
    {
        title: "Pending Assignments",
        value: "12",
        icon: FileText,
        description: "3 due this week",
        change: "High priority",
        changeType: "negative",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
    },
    {
        title: "Submissions to Review",
        value: "28",
        icon: Upload,
        description: "Need grading",
        change: "+5 since yesterday",
        changeType: "positive",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
    },
    {
        title: "Viva Sessions",
        value: "8",
        icon: Mic,
        description: "Scheduled this week",
        change: "Next in 2h",
        changeType: "neutral",
        color: "text-cyan-500",
        bg: "bg-cyan-500/10",
    },
]

export function SummaryCards() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
                <Card key={index} className="border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/20 group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            {stat.title}
                        </CardTitle>
                        <div className={`p-2 rounded-full ${stat.bg} ${stat.color}`}>
                            <stat.icon className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>{stat.description}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${stat.changeType === 'positive' ? 'bg-emerald-500/10 text-emerald-500' :
                                    stat.changeType === 'negative' ? 'bg-orange-500/10 text-orange-500' :
                                        'bg-secondary text-secondary-foreground'
                                }`}>
                                {stat.change}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
