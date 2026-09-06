import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { can, type Resource } from "../utils/can";
import { useAuth } from "../store/auth";

/**
 * Route-level gate: requires an authenticated user, and -- when `resource`
 * is supplied -- requires `can(role, "view", resource)`. This is the single
 * mechanism for route access now; it replaces the 4 previous page-local
 * `RoleGate` wraps (Users, Ars, Centers, Records) so nav (`Layout.tsx`),
 * routes (`App.tsx`), and buttons all read from the same `can()` table.
 */
export function ProtectedRoute({ children, resource }: { children: ReactNode; resource?: Resource }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <div className="page-center">{t("common.loading")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (resource && !can(user.role, "view", resource)) {
    return <div className="page-center text-muted">{t("common.accessDenied")}</div>;
  }
  return <>{children}</>;
}
