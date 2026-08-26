import type { ComponentType, ReactNode } from "react";
import {
  BriefcaseMedical,
  Bed,
  Calendar,
  ClipboardList,
  Folder,
  Hospital,
  LayoutDashboard,
  Pill,
  Settings,
  Shield,
  Stethoscope,
  Users,
  type LucideProps,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../store/auth";
import { can, type Resource } from "../utils/can";
import { roleLabel } from "../utils/roleLabel";
import { Logo } from "./Logo";
import { ToastHost } from "./ui";

// Nav visibility derives from the same `can(role, "view", resource)` check
// as route-level gating (`App.tsx`'s `ProtectedRoute`) and page-local
// buttons, so it can't drift from them again. Entries with no `resource`
// are open to every authenticated role (matches Dashboard).
const NAV: { to: string; key: string; resource?: Resource; icon: ComponentType<LucideProps> }[] = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/encounters", key: "nav.encounters", resource: "encounters", icon: ClipboardList },
  { to: "/patients", key: "nav.patients", resource: "patients", icon: Users },
  { to: "/doctors", key: "nav.doctors", resource: "doctors", icon: Stethoscope },
  { to: "/services", key: "nav.services", resource: "services", icon: BriefcaseMedical },
  { to: "/centers", key: "nav.centers", resource: "centers", icon: Hospital },
  { to: "/ars", key: "nav.ars", resource: "ars", icon: Shield },
  { to: "/medicines", key: "nav.medicines", resource: "medicines", icon: Pill },
  { to: "/rooms", key: "nav.rooms", resource: "rooms", icon: Bed },
  { to: "/appointments", key: "nav.appointments", resource: "appointments", icon: Calendar },
  { to: "/records", key: "nav.records", resource: "records", icon: Folder },
  { to: "/users", key: "nav.users", resource: "users", icon: Users },
  { to: "/settings", key: "nav.settings", resource: "settings", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const items = NAV.filter(
    (item) => !item.resource || can(user?.role, "view", item.resource),
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" end className="brand">
          <Logo size={28} />
          <span>{t("app.name")}</span>
        </NavLink>
        <nav className="nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              <item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-right">
            <span className="user-chip">
              {user?.full_name || user?.username}{" "}
              <span className="role-badge">{roleLabel(user?.role, i18n.language)}</span>
            </span>
            <button className="btn ghost" onClick={handleLogout}>
              {t("auth.logout")}
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
