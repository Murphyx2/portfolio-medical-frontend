import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/guards";
import { Appointments } from "./pages/Appointments";
import { Ars } from "./pages/Ars";
import { Centers } from "./pages/Centers";
import { Dashboard } from "./pages/Dashboard";
import { Doctors } from "./pages/Doctors";
import { Login } from "./pages/Login";
import { Medicines } from "./pages/Medicines";
import { Patients } from "./pages/Patients";
import { Records } from "./pages/Records";
import { Users } from "./pages/Users";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients"
        element={
          <ProtectedRoute>
            <Layout>
              <Patients />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctors"
        element={
          <ProtectedRoute>
            <Layout>
              <Doctors />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/centers"
        element={
          <ProtectedRoute>
            <Layout>
              <Centers />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/medicines"
        element={
          <ProtectedRoute>
            <Layout>
              <Medicines />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ars"
        element={
          <ProtectedRoute>
            <Layout>
              <Ars />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <Layout>
              <Appointments />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/records"
        element={
          <ProtectedRoute>
            <Layout>
              <Records />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Layout>
              <Users />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
