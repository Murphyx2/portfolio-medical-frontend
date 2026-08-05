import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import type { Role } from "../services/types";
import { useAuth } from "../store/auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RoleGate({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <div className="page-center text-muted">Access denied</div>;
  }
  return <>{children}</>;
}
