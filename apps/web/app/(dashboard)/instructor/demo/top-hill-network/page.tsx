import { TopHillSegmentNetworkDashboard } from "@/components/instructor/similarity-segment-graph/top-hill-segment-network-dashboard";

export const metadata = {
  title: "Top Hill segment network | Instructor",
  description: "Segment-level code similarity graph (demo dataset)",
};

export default function TopHillNetworkPage() {
  return <TopHillSegmentNetworkDashboard />;
}
