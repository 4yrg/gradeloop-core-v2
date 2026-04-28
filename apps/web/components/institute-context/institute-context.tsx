"use client";

import * as React from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { Building2 } from "lucide-react";

interface InstituteContextType {
  instituteName: string | null;
  instituteId: string | null;
  isLoading: boolean;
}

const InstituteContext = React.createContext<InstituteContextType>({
  instituteName: null,
  instituteId: null,
  isLoading: false,
});

export function useInstituteContext() {
  return React.useContext(InstituteContext);
}

interface InstituteProviderProps {
  children: React.ReactNode;
}

export function InstituteProvider({ children }: InstituteProviderProps) {
  const user = useAuthStore((state) => state.user);

  const [state, setState] = React.useState<InstituteContextType>({
    instituteName: null,
    instituteId: null,
    isLoading: false,
  });

  React.useEffect(() => {
    if (!user) {
      setState({ instituteName: null, instituteId: null, isLoading: false });
      return;
    }

    const instituteName = (user as any).tenant_name ?? (user as any).institute_name ?? (user as any).organization ?? "Institute";
    const instituteId = (user as any).tenant_id ?? (user as any).institute_id ?? (user as any).org_id ?? null;

    setState({
      instituteName,
      instituteId,
      isLoading: false,
    });
  }, [user]);

  return (
    <InstituteContext.Provider value={state}>
      {children}
    </InstituteContext.Provider>
  );
}

interface InstituteBadgeProps {
  className?: string;
}

export function InstituteBadge({ className = "" }: InstituteBadgeProps) {
  const { instituteName } = useInstituteContext();

  if (!instituteName) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium ${className}`}
    >
      <Building2 className="h-3 w-3" />
      <span>{instituteName}</span>
    </div>
  );
}