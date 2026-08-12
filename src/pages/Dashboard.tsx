import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../services/api";
import type { Appointment, Paginated, Patient, DoctorProfile } from "../services/types";
import { useAuth } from "../store/auth";

function statusLabel(t: (key: string) => string, status: string) {
  return t(`appointments.status${status[0]}${status.slice(1).toLowerCase()}`);
}

export function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [patients, setPatients] = useState(0);
  const [doctors, setDoctors] = useState(0);
  const [appointmentsTotal, setAppointmentsTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const todayParams = `date_time__gte=${startOfDay.toISOString()}&date_time__lt=${endOfDay.toISOString()}&ordering=date_time`;

    api.get<Paginated<Patient>>("/patients/?page_size=1").then((r) => setPatients(r.count)).catch(() => {});
    api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=1").then((r) => setDoctors(r.count)).catch(() => {});
    api.get<Paginated<Appointment>>("/appointments/?page_size=1").then((r) => setAppointmentsTotal(r.count)).catch(() => {});
    api
      .get<Paginated<Appointment>>(`/appointments/?${todayParams}&page_size=10`)
      .then((r) => {
        setTodayCount(r.count);
        setTodayAppointments(r.results);
      })
      .catch(() => {});
  }, []);

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
      {todayAppointments.length > 0 && (
        <div className="dashboard-today">
          <h3>{t("dashboard.appointmentsToday")}</h3>
          <ul className="dashboard-today-list">
            {todayAppointments.map((a) => (
              <li key={a.id} className="dashboard-today-item">
                <span className="dashboard-today-time">{new Date(a.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="dashboard-today-names">
                  {a.patient_info.full_name} &middot; {a.doctor_info.full_name}
                </span>
                <span className={`badge status-${a.status.toLowerCase()}`}>{statusLabel(t, a.status)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
