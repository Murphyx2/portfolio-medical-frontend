import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Spinner } from "../components/ui";
import { api } from "../services/api";
import type { Appointment, Paginated, Patient, DoctorProfile } from "../services/types";
import { useAuth } from "../store/auth";

function statusLabel(t: (key: string) => string, status: string) {
  return t(`appointments.status${status[0]}${status.slice(1).toLowerCase()}`);
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState(0);
  const [doctors, setDoctors] = useState(0);
  const [appointmentsTotal, setAppointmentsTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setHasError(false);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const todayParams = `date_time__gte=${startOfDay.toISOString()}&date_time__lt=${endOfDay.toISOString()}&ordering=date_time`;

    Promise.allSettled([
      api.get<Paginated<Patient>>("/patients/?page_size=1").then((r) => setPatients(r.count)),
      api.get<Paginated<DoctorProfile>>("/doctors/profiles/?page_size=1").then((r) => setDoctors(r.count)),
      api.get<Paginated<Appointment>>("/appointments/?page_size=1").then((r) => setAppointmentsTotal(r.count)),
      api.get<Paginated<Appointment>>(`/appointments/?${todayParams}&page_size=10`).then((r) => {
        setTodayCount(r.count);
        setTodayAppointments(r.results);
      }),
    ]).then((results) => {
      setHasError(results.some((r) => r.status === "rejected"));
      setLoading(false);
    });
  }, []);

  useEffect(load, [load]);

  const today = new Date().toLocaleDateString(i18n.language, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const cards: { key: string; value: number; label: string; to: string }[] = [
    { key: "appointmentsTotal", value: appointmentsTotal, label: t("dashboard.appointmentsTotal"), to: "/appointments" },
    { key: "appointmentsToday", value: todayCount, label: t("dashboard.appointmentsToday"), to: "/appointments" },
    { key: "patientsTotal", value: patients, label: t("dashboard.patientsTotal"), to: "/patients" },
    { key: "doctorsTotal", value: doctors, label: t("dashboard.doctorsTotal"), to: "/doctors" },
  ];

  return (
    <section>
      <div className="page-head">
        <h2>
          {t("dashboard.welcome")} {user?.full_name || user?.username}
        </h2>
        <span className="muted dashboard-date">{today}</span>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {hasError && (
            <p className="form-error" role="alert">
              {t("dashboard.loadError")}{" "}
              <button type="button" className="btn small ghost" onClick={load}>
                {t("dashboard.retry")}
              </button>
            </p>
          )}

          <h3 className="dashboard-overview-heading">{t("dashboard.overview")}</h3>
          <div className="stat-grid" aria-live="polite">
            {cards.map((c) => (
              <button
                key={c.key}
                type="button"
                className="stat-card"
                onClick={() => navigate(c.to)}
                aria-label={`${c.label}: ${c.value}`}
              >
                <strong>{c.value}</strong>
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          <div className="dashboard-today">
            <h3>{t("dashboard.appointmentsToday")}</h3>
            {todayAppointments.length > 0 ? (
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
            ) : (
              <p className="muted">{t("dashboard.noAppointmentsToday")}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
