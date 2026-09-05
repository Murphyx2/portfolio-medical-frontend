import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/guards";
import type { Resource } from "./utils/can";
import { Appointments } from "./pages/Appointments";
import { Ars } from "./pages/Ars";
import { Centers } from "./pages/Centers";
import { ComposeMessage } from "./pages/communications/ComposeMessage";
import { Communications } from "./pages/communications/Communications";
import { CommunicationsSettingsPage } from "./pages/communications/CommunicationsSettingsPage";
import { CommunicationsTemplates } from "./pages/communications/CommunicationsTemplates";
import { Dashboard } from "./pages/Dashboard";
import { Doctors } from "./pages/Doctors";
import { Encounters } from "./pages/Encounters";
import { Login } from "./pages/Login";
import { Medicines } from "./pages/Medicines";
import { Patients } from "./pages/Patients";
import { Records } from "./pages/Records";
import { RecordApTypes } from "./pages/RecordApTypes";
import { Reportes } from "./pages/Reportes";
import { Rooms } from "./pages/Rooms";
import { RoomTypes } from "./pages/RoomTypes";
import { Settings } from "./pages/Settings";
import { ServicePrices } from "./pages/ServicePrices";
import { ServiceTypes } from "./pages/ServiceTypes";
import { Services } from "./pages/Services";
import { Users } from "./pages/Users";

/**
 * Data-driven route table. Each entry's `resource` (when present) is the
 * single thing `ProtectedRoute` checks via `can(role, "view", resource)` --
 * replaces the previous hand-written per-route JSX plus the 4 page-local
 * `RoleGate` wraps (Users, Ars, Centers, Records). Routes with no `resource`
 * stay open to all authenticated roles, matching current nav/page behavior
 * (Dashboard has no resource of its own).
 */
const ROUTES: { path: string; element: ReactNode; resource?: Resource }[] = [
  { path: "/", element: <Dashboard /> },
  { path: "/patients", element: <Patients />, resource: "patients" },
  { path: "/doctors", element: <Doctors />, resource: "doctors" },
  { path: "/centers", element: <Centers />, resource: "centers" },
  { path: "/medicines", element: <Medicines />, resource: "medicines" },
  { path: "/rooms", element: <Rooms />, resource: "rooms" },
  { path: "/rooms/types", element: <RoomTypes />, resource: "roomTypes" },
  { path: "/ars", element: <Ars />, resource: "ars" },
  { path: "/appointments", element: <Appointments />, resource: "appointments" },
  { path: "/reportes", element: <Reportes />, resource: "reportes" },
  { path: "/comunicaciones", element: <Communications />, resource: "communications" },
  { path: "/comunicaciones/nuevo", element: <ComposeMessage />, resource: "communications" },
  {
    path: "/comunicaciones/plantillas",
    element: <CommunicationsTemplates />,
    resource: "communicationsSettings",
  },
  {
    path: "/comunicaciones/ajustes",
    element: <CommunicationsSettingsPage />,
    resource: "communicationsSettings",
  },
  { path: "/encounters", element: <Encounters />, resource: "encounters" },
  { path: "/records", element: <Records />, resource: "records" },
  { path: "/records/types", element: <RecordApTypes />, resource: "recordApTypes" },
  { path: "/services", element: <Services />, resource: "services" },
  { path: "/services/types", element: <ServiceTypes />, resource: "serviceTypes" },
  { path: "/services/prices", element: <ServicePrices />, resource: "servicePrices" },
  { path: "/users", element: <Users />, resource: "users" },
  { path: "/settings", element: <Settings />, resource: "settings" },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {ROUTES.map(({ path, element, resource }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute resource={resource}>
              <Layout>{element}</Layout>
            </ProtectedRoute>
          }
        />
      ))}
    </Routes>
  );
}
