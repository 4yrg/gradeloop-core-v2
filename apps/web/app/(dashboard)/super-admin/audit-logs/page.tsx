"use client";

import * as React from "react";
import { FileText, Search, Download, Filter, User, Building2, Shield, LogIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  description: string;
  entity_type: string;
  entity_id: string;
  ip_address: string;
  created_at: string;
}

const mockLogs: AuditLog[] = [
  { id: "1", user_id: "u1", user_email: "admin@stanford.edu", action: "tenant.create", description: "Created tenant: Stanford University", entity_type: "tenant", entity_id: "t1", ip_address: "192.168.1.1", created_at: "2024-01-15 10:30:00" },
  { id: "2", user_id: "u2", user_email: "admin@mit.edu", action: "user.invite", description: "Invited new user", entity_type: "user", entity_id: "u3", ip_address: "192.168.1.2", created_at: "2024-01-15 09:45:00" },
  { id: "3", user_id: "u1", user_email: "admin@stanford.edu", action: "role.update", description: "Updated role permissions", entity_type: "role", entity_id: "r1", ip_address: "192.168.1.1", created_at: "2024-01-15 08:20:00" },
  { id: "4", user_id: "u3", user_email: "super@admin.com", action: "auth.login", description: "Successful login", entity_type: "session", entity_id: "s1", ip_address: "10.0.0.1", created_at: "2024-01-14 16:00:00" },
  { id: "5", user_id: "u4", user_email: "admin@oxford.edu", action: "tenant.update", description: "Updated tenant settings", entity_type: "tenant", entity_id: "t2", ip_address: "192.168.1.3", created_at: "2024-01-14 14:30:00" },
];

const actionIcons: Record<string, React.ReactNode> = {
  "tenant.create": <Building2 className="h-4 w-4" />,
  "tenant.update": <Building2 className="h-4 w-4" />,
  "user.invite": <User className="h-4 w-4" />,
  "role.update": <Shield className="h-4 w-4" />,
  "auth.login": <LogIn className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  "tenant.create": "bg-green-100 text-green-700",
  "tenant.update": "bg-blue-100 text-blue-700",
  "user.invite": "bg-purple-100 text-purple-700",
  "role.update": "bg-orange-100 text-orange-700",
  "auth.login": "bg-gray-100 text-gray-700",
};

export default function AuditLogsPage() {
  const [search, setSearch] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("all");

  const filteredLogs = React.useMemo(() => {
    return mockLogs.filter(log => {
      const matchesSearch = !search || 
        log.user_email.toLowerCase().includes(search.toLowerCase()) ||
        log.description.toLowerCase().includes(search.toLowerCase());
      const matchesAction = actionFilter === "all" || log.action.startsWith(actionFilter);
      return matchesSearch && matchesAction;
    });
  }, [search, actionFilter]);

  const actions = React.useMemo(() => {
    const unique = [...new Set(mockLogs.map(l => l.action.split('.')[0]))];
    return unique;
  }, []);

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Platform activity and compliance logs</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{mockLogs.length}</p>
              <p className="text-sm text-muted-foreground">Total Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{mockLogs.filter(l => l.action.includes('tenant')).length}</p>
              <p className="text-sm text-muted-foreground">Tenant Actions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{mockLogs.filter(l => l.action.includes('user')).length}</p>
              <p className="text-sm text-muted-foreground">User Actions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{mockLogs.filter(l => l.action.includes('login')).length}</p>
              <p className="text-sm text-muted-foreground">Logins Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent platform activities</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions.map(action => (
                    <SelectItem key={action} value={action}>
                      {action.charAt(0).toUpperCase() + action.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground">
                    {log.created_at}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{log.user_email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={actionColors[log.action] || "bg-gray-100"}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {log.ip_address}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}