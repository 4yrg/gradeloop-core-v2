declare module "@/lib/auth" {
  export type User = {
    id?: string;
    name?: string;
    email?: string;
    permissions?: string[];
  };

  export function useAuth(): {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (u: User | null) => void;
    logout: () => void;
  };

  const _default: typeof useAuth;
  export default _default;
}
