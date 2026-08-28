import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  BriefcaseMedical,
  Bed,
  Calendar,
  ChevronLeft,
  ClipboardList,
  Folder,
  Hospital,
  LayoutDashboard,
  Mail,
  Pill,
  Settings,
  Shield,
  Stethoscope,
  Users,
  type LucideProps,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";

import { useIntervalCount } from "../hooks/useIntervalCount";
import type { Role } from "../services/types";
import { useAuth } from "../store/auth";
import { can, type Resource } from "../utils/can";
import { roleLabel } from "../utils/roleLabel";
import { Logo } from "./Logo";
import { ToastHost } from "./ui";

type NavItem = { to: string; key: string; resource?: Resource; icon: ComponentType<LucideProps> };

// Nav visibility derives from the same `can(role, "view", resource)` check
// as route-level gating (`App.tsx`'s `ProtectedRoute`) and page-local
// buttons, so it can't drift from them again. Grouping below is purely
// visual -- applied after filtering, never before, so RBAC never changes.
const DASHBOARD_ITEM: NavItem = { to: "/", key: "nav.dashboard", icon: LayoutDashboard };

export const NAV_GROUPS: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: "nav.groups.atencion",
    items: [
      { to: "/encounters", key: "nav.encounters", resource: "encounters", icon: ClipboardList },
      { to: "/patients", key: "nav.patients", resource: "patients", icon: Users },
      { to: "/appointments", key: "nav.appointments", resource: "appointments", icon: Calendar },
      { to: "/records", key: "nav.recordsShort", resource: "records", icon: Folder },
    ],
  },
  {
    titleKey: "nav.groups.operacion",
    items: [
      { to: "/doctors", key: "nav.doctors", resource: "doctors", icon: Stethoscope },
      { to: "/rooms", key: "nav.rooms", resource: "rooms", icon: Bed },
      { to: "/services", key: "nav.services", resource: "services", icon: BriefcaseMedical },
      { to: "/medicines", key: "nav.medicines", resource: "medicines", icon: Pill },
    ],
  },
  {
    titleKey: "nav.groups.red",
    items: [
      { to: "/centers", key: "nav.centers", resource: "centers", icon: Hospital },
      { to: "/ars", key: "nav.ars", resource: "ars", icon: Shield },
    ],
  },
];

// Pie: no group title, divider above, pinned at the bottom -- Configuración
// always lives here, never adjacent to Dashboard.
export const NAV_FOOT: NavItem[] = [
  { to: "/comunicaciones", key: "nav.communications", resource: "communications", icon: Mail },
  { to: "/users", key: "nav.users", resource: "users", icon: Users },
  { to: "/settings", key: "nav.settings", resource: "settings", icon: Settings },
];

export function filterItems(items: NavItem[], role: Role | undefined): NavItem[] {
  return items.filter((item) => !item.resource || can(role, "view", item.resource));
}

export function filterGroups(
  groups: { titleKey: string; items: NavItem[] }[],
  role: Role | undefined,
): { titleKey: string; items: NavItem[] }[] {
  return groups
    .map((g) => ({ ...g, items: filterItems(g.items, role) }))
    .filter((g) => g.items.length > 0);
}

function initialsOf(fullName: string | undefined, username: string | undefined): string {
  const source = (fullName?.trim() || username?.trim() || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const COLLAPSED_KEY = "incaf.sidebar.collapsed";

export function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const filteredGroups = filterGroups(NAV_GROUPS, user?.role);
  const filteredFoot = filterItems(NAV_FOOT, user?.role);

  const appointmentsBadge = useIntervalCount(
    can(user?.role, "view", "appointments") ? "/appointments/today_remaining_count/" : null,
  );
  const communicationsBadge = useIntervalCount(
    can(user?.role, "view", "communications")
      ? "/communications/messages/?status__in=DRAFT,FAILED&page_size=1"
      : null,
  );
  const badgeByPath = new Map<string, number>([
    ["/appointments", appointmentsBadge],
    ["/comunicaciones", communicationsBadge],
  ]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "nav-link active" : "nav-link");

  function renderItem(item: NavItem) {
    const badge = badgeByPath.get(item.to) ?? 0;
    return (
      <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass}>
        <item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
        <span className="nav-label">{t(item.key)}</span>
        {badge > 0 && <span className="nav-badge">{badge}</span>}
      </NavLink>
    );
  }

  return (
    <div className="app-shell">
      <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
        <NavLink to="/" end className="brand">
          <Logo size={28} />
          <span className="brand-label">{t("app.name")}</span>
        </NavLink>

        <nav className="nav-groups">
          <div className="nav-group">{renderItem(DASHBOARD_ITEM)}</div>
          {filteredGroups.map((group) => (
            <div className="nav-group" key={group.titleKey}>
              <div className="nav-group-title">{t(group.titleKey)}</div>
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>

        <div className="nav-foot">
          {filteredFoot.map(renderItem)}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          >
            <ChevronLeft size={16} strokeWidth={2} className={collapsed ? "flip" : undefined} aria-hidden="true" />
            <span className="nav-label">{collapsed ? t("nav.expand") : t("nav.collapse")}</span>
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-right">
            <div className="user-stack">
              <span className="user-avatar" aria-hidden="true">
                {initialsOf(user?.full_name, user?.username)}
              </span>
              <span className="user-text">
                <span className="user-name">{user?.full_name || user?.username}</span>
                <span className="user-role">{roleLabel(user?.role, i18n.language)}</span>
              </span>
            </div>
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
