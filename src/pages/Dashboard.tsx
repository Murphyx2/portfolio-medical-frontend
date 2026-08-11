import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../services/api";
import type { Appointment, Paginated, Patient, DoctorProfile } from "../services/types";
import { useAuth } from "../store/auth";

export function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [patients, setPatients] = useState(0);
  const [doctors, setDoctors] = useState(0);
  const [appointmentsTotal, setAppointmentsTotal] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    api.get<Paginated<Patient>>("/patients/?page_size=1").then((r) => setPatients(r.count)).catch(() => {});
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=1").then((r) => setDoctors(r.count)).catch(() => {});
    api.get<Paginated<Appointment>>("/appointments/?page_size=1").then((r) => setAppointmentsTotal(r.count)).catch(() => {});
    api
      .get<Paginated<Appointment>>("/appointments/?ordering=date_time&page_size=5")
      .then((r) => setAppointments(r.results))
      .catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = appointments.filter((a) => a.date_time.slice(0, 10) === today).length;

  return (
    <section>
      <div className="page-head">
        <h2>
          {t("dashboard.welcome")} {user?.full_name || user?.username}
        </h2>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <strong>{appointmentsTotal}</strong>
          <span>{t("dashboard.appointmentsTotal")}</span>
        </div>
        <div className="stat-card">
          <strong>{todayCount}</strong>
          <span>{t("dashboard.appointmentsToday")}</span>
        </div>
        <div className="stat-card">
          <strong>{patients}</strong>
          <span>{t("dashboard.patientsTotal")}</span>
        </div>
        <div className="stat-card">
          <strong>{doctors}</strong>
          <span>{t("dashboard.doctorsTotal")}</span>
        </div>
      </div>
    </section>
  );
}
