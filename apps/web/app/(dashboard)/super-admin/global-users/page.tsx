"use client";

import * as React from "react";
import { Users, Search, Download, MoreHorizontal, Shield, Mail, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GlobalUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_name: string;
  tenant_id: string;
  is_active: boolean;
  email_verified: boolean;
  last_login: string;
  created_at: string;
}

const mockUsers: GlobalUser[] = [
  { id: "1", email: "admin@stanford.edu", full_name: "John Smith", role: "admin", tenant_name: "Stanford University", tenant_id: "t1", is_active: true, email_verified: true, last_login: "2024-01-15 10:30:00", created_at: "2023-06-15" },
  { id: "2", email: "professor@mit.edu", full_name: "Sarah Johnson", role: "instructor", tenant_name: "MIT", tenant_id: "t2", is_active: true, email_verified: true, last_login: "2024-01-15 09:45:00", created_at: "2023-07-20" },
  { id: "3", email: "student@oxford.edu", full_name: "Emma Wilson", role: "student", tenant_name: "Oxford University", tenant_id: "t3", is_active: true, email_verified: true, last_login: "2024-01-14 16:00:00", created_at: "2023-09-01" },
  { id: "4", email: "admin@cambridge.edu", full_name: "Michael Brown", role: "admin", tenant_name: "Cambridge", tenant_id: "t4", is_active: false, email_verified: true, last_login: "2024-01-10 14:30:00", created_at: "2023-05-10" },
  { id: "5", email: "ta@harvard.edu", full_name: "Lisa Davis", role: "instructor", tenant_name: "Harvard", tenant_id: "t5", is_active: true, email_verified: false, last_login: "2024-01-14 11:20:00", created_at: "2023-08-15" },
];

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  super_admin: "bg-red-100 text-red-700",
  instructor: "bg-blue-100 text-blue-700",
  student: "bg-green-100 text-green-700",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function GlobalUsersPage() {
  const [search, setSearch] = React.useState("");
  const [tenantFilter, setTenantFilter] = React.useState("all");
  const [roleFilter, setRoleFilter] = React.useState("all");

  const filteredUsers = React.useMemo(() => {
    return mockUsers.filter((user) => {
      const matchesSearch =
        !search ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.full_name.toLowerCase().includes(search.toLowerCase());
      const matchesTenant = tenantFilter === "all" || user.tenant_id === tenantFilter;
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesTenant && matchesRole;
    });
  }, [search, tenantFilter, roleFilter]);

  const tenants = React.useMemo(() => {
    const unique = [...new Set(mockUsers.map((u) => u.tenant_name))];
    return unique;
  }, []);

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Global Users</h1>
          <p className="text-muted-foreground mt-1">Manage users across all tenants</p>
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
              <p className="text-3xl font-bold">{mockUsers.length}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{mockUsers.filter((u) => u.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{mockUsers.filter((u) => !u.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Suspended</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{mockUsers.filter((u) => u.role === "admin").length}</p>
              <p className="text-sm text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Users from all tenants in the platform</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tenants</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant} value={tenant}>
                      {tenant}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="instructor">Instructor</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={roleColors[user.role] || "bg-gray-100"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{user.tenant_name}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.is_active ? "success" : "secondary"}>
                        {user.is_active ? "Active" : "Suspended"}
                      </Badge>
                      {!user.email_verified && (
                        <Badge variant="outline" className="text-amber-600">
                          Unverified
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.last_login}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Shield className="mr-2 h-4 w-4" />
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Suspend User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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