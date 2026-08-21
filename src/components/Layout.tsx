import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../store/auth";
import { can, type Resource } from "../utils/can";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ToastHost } from "./ui";

// Nav visibility derives from the same `can(role, "view", resource)` check
// as route-level gating (`App.tsx`'s `ProtectedRoute`) and page-local
// buttons, so it can't drift from them again. Entries with no `resource`
// are open to every authenticated role (matches Dashboard).
const NAV: { to: string; key: string; resource?: Resource }[] = [
  { to: "/", key: "nav.dashboard" },
  { to: "/encounters", key: "nav.encounters", resource: "encounters" },
  { to: "/patients", key: "nav.patients", resource: "patients" },
  { to: "/doctors", key: "nav.doctors", resource: "doctors" },
  { to: "/services", key: "nav.services", resource: "services" },
  { to: "/centers", key: "nav.centers", resource: "centers" },
  { to: "/ars", key: "nav.ars", resource: "ars" },
  { to: "/medicines", key: "nav.medicines", resource: "medicines" },
  { to: "/rooms", key: "nav.rooms", resource: "rooms" },
  { to: "/appointments", key: "nav.appointments", resource: "appointments" },
  { to: "/records", key: "nav.records", resource: "records" },
  { to: "/users", key: "nav.users", resource: "users" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
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
        <span className="brand">{t("app.name")}</span>
        <nav className="nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-right">
            <LanguageSwitcher />
            <span className="user-chip">
              {user?.full_name || user?.username}{" "}
              <span className="role-badge">{user?.role}</span>
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
