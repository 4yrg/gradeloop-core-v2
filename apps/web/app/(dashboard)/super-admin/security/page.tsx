"use client";

import * as React from "react";
import {
  Shield,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  Users,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

interface SecurityMetricProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: string;
}

function SecurityMetric({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendUp,
  color = "text-primary",
}: SecurityMetricProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            <div className="flex items-center gap-2 mt-1">
              {trend && (
                <span className={`text-xs ${trendUp ? "text-green-500" : "text-red-500"}`}>
                  {trend}
                </span>
              )}
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className={`h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RiskAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  user: string;
  tenant: string;
  description: string;
  timestamp: string;
  status: "open" | "investigating" | "resolved";
}

interface Lockout {
  id: string;
  user: string;
  tenant: string;
  reason: string;
  timestamp: string;
  attempts: number;
}

interface FailedLogin {
  id: string;
  email: string;
  tenant: string;
  ip_address: string;
  timestamp: string;
  user_agent: string;
}

const mockRiskAlerts: RiskAlert[] = [
  {
    id: "1",
    severity: "critical",
    type: "Brute Force Attack",
    user: "unknown_user_123@stanford.edu",
    tenant: "Stanford University",
    description: "Multiple failed login attempts from suspicious IP range",
    timestamp: "2024-01-15 10:30:00",
    status: "investigating",
  },
  {
    id: "2",
    severity: "high",
    type: "Unusual Location",
    user: "john.smith@mit.edu",
    tenant: "MIT",
    description: "Login from new country (Russia) after typical location (US)",
    timestamp: "2024-01-15 09:15:00",
    status: "open",
  },
  {
    id: "3",
    severity: "medium",
    type: "Password Policy Violation",
    user: "sarah.j@oxford.edu",
    tenant: "Oxford University",
    description: "User attempted to set weak password 5 times",
    timestamp: "2024-01-15 08:45:00",
    status: "resolved",
  },
  {
    id: "4",
    severity: "high",
    type: "Suspicious API Activity",
    user: "api_service@harvard.edu",
    tenant: "Harvard",
    description: "Unusual API request volume from service account",
    timestamp: "2024-01-15 07:30:00",
    status: "open",
  },
  {
    id: "5",
    severity: "low",
    type: "Failed MFA Attempts",
    user: "emma.w@cambridge.edu",
    tenant: "Cambridge",
    description: "3 failed MFA attempts in 5 minutes",
    timestamp: "2024-01-15 06:00:00",
    status: "resolved",
  },
];

const mockLockouts: Lockout[] = [
  { id: "1", user: "admin@stanford.edu", tenant: "Stanford University", reason: "Failed password 5 times", timestamp: "2024-01-15 10:28:00", attempts: 5 },
  { id: "2", user: "unknown_user_123@stanford.edu", tenant: "Stanford University", reason: "Brute force detected", timestamp: "2024-01-15 10:30:00", attempts: 23 },
  { id: "3", user: "professor.mit@mit.edu", tenant: "MIT", reason: "Failed password 5 times", timestamp: "2024-01-14 22:15:00", attempts: 5 },
];

const mockFailedLogins: FailedLogin[] = [
  { id: "1", email: "admin@stanford.edu", tenant: "Stanford University", ip_address: "192.168.1.100", timestamp: "2024-01-15 10:28:00", user_agent: "Chrome/120.0" },
  { id: "2", email: "unknown_user_123@stanford.edu", tenant: "Stanford University", ip_address: "45.33.99.123", timestamp: "2024-01-15 10:27:00", user_agent: "curl/7.68.0" },
  { id: "3", email: "professor.mit@mit.edu", tenant: "MIT", ip_address: "192.168.2.50", timestamp: "2024-01-14 22:14:00", user_agent: "Firefox/121.0" },
  { id: "4", email: "student@oxford.edu", tenant: "Oxford University", ip_address: "10.0.0.25", timestamp: "2024-01-14 15:30:00", user_agent: "Safari/17.0" },
];

const severityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  investigating: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
};

type AlertTab = "risk" | "lockouts" | "failed";

export default function SecurityPage() {
  const [activeTab, setActiveTab] = React.useState<AlertTab>("risk");
  const [severityFilter, setSeverityFilter] = React.useState("all");
  const [alertSearch, setAlertSearch] = React.useState("");

  const filteredAlerts = React.useMemo(() => {
    return mockRiskAlerts.filter((alert) => {
      const matchesSearch =
        !alertSearch ||
        alert.user.toLowerCase().includes(alertSearch.toLowerCase()) ||
        alert.tenant.toLowerCase().includes(alertSearch.toLowerCase()) ||
        alert.type.toLowerCase().includes(alertSearch.toLowerCase());
      const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [alertSearch, severityFilter]);

  const totalMFAEnabled = 18432;
  const totalUsers = 24567;
  const mfaRate = Math.round((totalMFAEnabled / totalUsers) * 100);

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Security Center</h1>
          <p className="text-muted-foreground mt-1">Monitor platform-wide security metrics</p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <SecurityMetric
          title="MFA Compliance Rate"
          value={`${mfaRate}%`}
          subtitle={`${totalMFAEnabled.toLocaleString()} of ${totalUsers.toLocaleString()} users`}
          icon={<Shield className="h-6 w-6" />}
          trend="+2.3% this month"
          trendUp={true}
          color="text-green-600"
        />
        <SecurityMetric
          title="Active Lockouts"
          value={mockLockouts.length}
          subtitle="Accounts temporarily locked"
          icon={<Lock className="h-6 w-6" />}
          color="text-red-600"
        />
        <SecurityMetric
          title="Failed Logins (24h)"
          value={127}
          subtitle="Across all tenants"
          icon={<XCircle className="h-6 w-6" />}
          trend="-15% from yesterday"
          trendUp={true}
          color="text-amber-600"
        />
        <SecurityMetric
          title="Open Risk Alerts"
          value={mockRiskAlerts.filter((a) => a.status !== "resolved").length}
          subtitle="Requiring attention"
          icon={<AlertTriangle className="h-6 w-6" />}
          color="text-red-600"
        />
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>MFA Adoption by Tenant</CardTitle>
          <CardDescription>Multi-factor authentication compliance rate per tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: "Stanford University", rate: 94, users: 4521 },
            { name: "MIT", rate: 89, users: 1234 },
            { name: "Oxford University", rate: 76, users: 234 },
            { name: "Cambridge", rate: 82, users: 234 },
            { name: "Harvard", rate: 67, users: 890 },
          ].map((tenant) => (
            <div key={tenant.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{tenant.name}</span>
                <span className="text-muted-foreground">
                  {tenant.rate}% ({tenant.users.toLocaleString()} users)
                </span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-gray-200">
                <div
                  className={`absolute left-0 top-0 h-2 rounded-full ${
                    tenant.rate >= 90
                      ? "bg-green-500"
                      : tenant.rate >= 75
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${tenant.rate}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {activeTab === "risk" && "Risk Alerts"}
                {activeTab === "lockouts" && "Account Lockouts"}
                {activeTab === "failed" && "Failed Login Attempts"}
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeTab === "risk" ? "default" : "outline"}
                onClick={() => setActiveTab("risk")}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Risk
              </Button>
              <Button
                variant={activeTab === "lockouts" ? "default" : "outline"}
                onClick={() => setActiveTab("lockouts")}
              >
                <Lock className="mr-2 h-4 w-4" />
                Lockouts
              </Button>
              <Button
                variant={activeTab === "failed" ? "default" : "outline"}
                onClick={() => setActiveTab("failed")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Failed Logins
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "risk" && (
            <>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search alerts..."
                    value={alertSearch}
                    onChange={(e) => setAlertSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  variant={severityFilter === "all" ? "default" : "outline"}
                  onClick={() => setSeverityFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={severityFilter === "critical" ? "destructive" : "outline"}
                  onClick={() => setSeverityFilter("critical")}
                >
                  Critical
                </Button>
                <Button
                  variant={severityFilter === "high" ? "default" : "outline"}
                  onClick={() => setSeverityFilter("high")}
                >
                  High
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <Badge className={severityColors[alert.severity]}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{alert.type}</TableCell>
                      <TableCell>{alert.user}</TableCell>
                      <TableCell>{alert.tenant}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[alert.status]}>
                          {alert.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{alert.timestamp}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {activeTab === "lockouts" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockLockouts.map((lockout) => (
                  <TableRow key={lockout.id}>
                    <TableCell className="font-medium">{lockout.user}</TableCell>
                    <TableCell>{lockout.tenant}</TableCell>
                    <TableCell>{lockout.reason}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{lockout.attempts}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lockout.timestamp}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">
                        <Unlock className="mr-2 h-4 w-4" />
                        Unlock
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {activeTab === "failed" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User Agent</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockFailedLogins.map((login) => (
                  <TableRow key={login.id}>
                    <TableCell className="font-medium">{login.email}</TableCell>
                    <TableCell>{login.tenant}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{login.ip_address}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{login.user_agent}</TableCell>
                    <TableCell className="text-muted-foreground">{login.timestamp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}