import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

const recentActivities = [
    {
        id: 1,
        user: {
            name: "Alice Johnson",
            avatar: "/avatars/01.png",
            initials: "AJ",
        },
        action: "submitted assignment",
        target: "Data Structures - Week 4",
        time: "2 hours ago",
        type: "submission",
    },
    {
        id: 2,
        user: {
            name: "System AI",
            avatar: "",
            initials: "AI",
        },
        action: "flagged plagiarism",
        target: "Bob Smith's Submission",
        time: "4 hours ago",
        type: "alert",
    },
    {
        id: 3,
        user: {
            name: "Carol Williams",
            avatar: "/avatars/03.png",
            initials: "CW",
        },
        action: "commented on",
        target: "Viva Feedback",
        time: "5 hours ago",
        type: "comment",
    },
    {
        id: 4,
        user: {
            name: "David Brown",
            avatar: "/avatars/04.png",
            initials: "DB",
        },
        action: "completed quiz",
        target: "Database Normalization",
        time: "Yesterday",
        type: "submission",
    },
    {
        id: 5,
        user: {
            name: "Eva Davis",
            avatar: "/avatars/05.png",
            initials: "ED",
        },
        action: "submitted assignment",
        target: "Algorithm Analysis",
        time: "Yesterday",
        type: "submission",
    },
]

export function RecentActivity() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium tracking-tight">Recent Activity</h3>
                <Badge variant="outline" className="font-normal text-muted-foreground bg-secondary/30">
                    Last 24 hours
                </Badge>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
                <ScrollArea className="h-[300px]">
                    <div className="divide-y divide-border/50">
                        {recentActivities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                                <Avatar className="h-8 w-8 mt-1 border border-border">
                                    <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
                                    <AvatarFallback className={activity.type === 'alert' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}>
                                        {activity.user.initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid gap-1">
                                    <p className="text-sm font-medium leading-none">
                                        <span className="font-semibold text-foreground">{activity.user.name}</span>{" "}
                                        <span className="text-muted-foreground font-normal">{activity.action}</span>{" "}
                                        <span className="text-primary font-medium">{activity.target}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        {activity.time}
                                        {activity.type === 'alert' && (
                                            <Badge variant="destructive" className="h-4 px-1 text-[10px] ml-1">High Risk</Badge>
                                        )}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
