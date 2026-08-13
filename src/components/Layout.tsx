import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../store/auth";
import type { Role } from "../services/types";
import { LanguageSwitcher } from "./LanguageSwitcher";

const NAV: { to: string; key: string; roles?: Role[] }[] = [
  { to: "/", key: "nav.dashboard" },
  { to: "/patients", key: "nav.patients" },
  { to: "/doctors", key: "nav.doctors" },
  { to: "/services", key: "nav.services" },
  { to: "/centers", key: "nav.centers" },
  { to: "/ars", key: "nav.ars", roles: ["ADMIN", "RECEPTIONIST"] },
  { to: "/medicines", key: "nav.medicines" },
  { to: "/appointments", key: "nav.appointments" },
  { to: "/records", key: "nav.records" },
  { to: "/users", key: "nav.users", roles: ["ADMIN", "IT"] },
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
    (item) => !item.roles || (user && item.roles.includes(user.role)),
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
    </div>
  );
}
