export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  is_active: boolean;
  settings?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  student_count: number;
  instructor_count: number;
  admin_count: number;
  super_admin_count: number;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  domain: string;
  settings?: string;
}

export interface UpdateTenantRequest {
  name?: string;
  domain?: string;
  is_active?: boolean;
  settings?: string;
}

export interface TenantListResponse {
  tenants: Tenant[];
  total_count: number;
  page: number;
  limit: number;
}