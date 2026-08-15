import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { PatientFormModal } from "../components/PatientFormModal";
import { Dialog, GuardianCedulaIcon, MaskedValue, Page, Pagination, SearchBar, Spinner, Table, type Column, type SortDir } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api } from "../services/api";
import type { Paginated, Patient } from "../services/types";
import { useAuth } from "../store/auth";
import { formatCedula } from "../utils/cedula";
import { formatPhone } from "../utils/phone";

export function Patients() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN" || user?.role === "DOCTOR";
  const [rows, setRows] = useState<Patient[]>([]);
  const [modal, setModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [detail, setDetail] = useState<Patient | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const {
    page,
    setPage,
    pageSize,
    count,
    setCount,
    search,
    setSearch,
    searchSubmit,
    sortKey,
    sortDir,
    handleSort,
    changePageSize,
    initialLoading,
    runList,
    query,
  } = useListControls();

  const qs = query({ include_inactive: showInactive ? "true" : "" });

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<Patient>>(`/patients/?${qs}`, { signal }))
      .then((r) => {
        if (!r) return;
        setRows(r.results);
        setCount(r.count);
        const total = Math.ceil(r.count / pageSize);
        if (total > 0 && page > total) setPage(total);
      })
      .catch(() => {});
  }, [qs, page, pageSize, setCount, setPage, runList]);

  useEffect(load, [load]);

  // cedula/nss/phone/email/age are encrypted at rest: the backend can't sort
  // them in SQL and simply ignores an `?ordering=` request for them (falls
  // back to default ordering). Sort those columns client-side, on the
  // currently-loaded page only, instead of routing the click through the
  // server-driven sort in useListControls.
  const CLIENT_SORT_KEYS = new Set(["phone", "email", "cedula", "nss", "age"]);
  const [clientSort, setClientSort] = useState<{ key: string; dir: SortDir } | null>(null);

  function handleColumnSort(key: string) {
    if (CLIENT_SORT_KEYS.has(key)) {
      setClientSort((prev) => {
        if (!prev || prev.key !== key) return { key, dir: "asc" };
        if (prev.dir === "asc") return { key, dir: "desc" };
        return null;
      });
      return;
    }
    setClientSort(null);
    handleSort(key);
  }

  function clientSortValue(p: Patient, key: string): string | number | null {
    switch (key) {
      case "age":
        return p.age ?? null;
      case "phone":
        return p.phone || null;
      case "email":
        return p.email || null;
      case "cedula":
        return p.cedula || null;
      case "nss":
        return p.nss || null;
      default:
        return null;
    }
  }

  const displayRows = useMemo(() => {
    if (!clientSort) return rows;
    const { key, dir } = clientSort;
    return [...rows].sort((a, b) => {
      const av = clientSortValue(a, key);
      const bv = clientSortValue(b, key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, clientSort]);

  function openNew() {
    setEditingPatient(null);
    setModal(true);
  }

  function openEdit(p: Patient) {
    setEditingPatient(p);
    setModal(true);
  }

  async function remove(p: Patient) {
    await api.delete(`/patients/${p.id}/`);
    load();
  }

  async function restore(p: Patient) {
    await api.post(`/patients/${p.id}/restore/`, {});
    load();
  }

  async function openDetail(p: Patient) {
    setOpeningId(p.id);
    try {
      const full = await api.get<Patient>(`/patients/${p.id}/`);
      setDetail(full);
    } finally {
      setOpeningId(null);
    }
  }

  const genderLabels: Record<string, string> = {
    MALE: t("patients.genderMale"),
    FEMALE: t("patients.genderFemale"),
  };

  // Matches Records.tsx's click-to-detail pattern: Name/Cedula/NSS cells
  // become links that open a read-only "complete information" dialog
  // instead of trying to fit every field into the table.
  const openDetailLink = (r: Patient, content: ReactNode) => (
    <button type="button" className="row-link" disabled={openingId === r.id} onClick={() => openDetail(r)}>
      {openingId === r.id ? t("common.loading") : content}
    </button>
  );

  const columns: Column<Patient>[] = [
    {
      key: "full_name",
      header: t("common.name"),
      sortKey: "search_name",
      render: (r) => openDetailLink(r, <MaskedValue value={r.full_name} />),
    },
    { key: "age", header: t("patients.age"), sortKey: "age", render: (r) => (r.age ?? "—") },
    {
      key: "gender",
      header: t("patients.gender"),
      sortKey: "gender",
      render: (r) => genderLabels[r.gender] ?? r.gender,
    },
    {
      key: "cedula",
      header: t("patients.cedula"),
      sortKey: "cedula",
      render: (r) => {
        // For a minor with guardian info on file, this column shows the
        // guardian's cedula instead of the patient's own -- the same value
        // can therefore legitimately repeat across sibling rows. The
        // patient's own cedula is always shown in the detail modal.
        const showsGuardian = (r.age ?? 99) < 18 && r.has_guardian && !!r.guardian_cedula;
        const raw = showsGuardian ? r.guardian_cedula : r.cedula;
        const formatted = raw ? (raw.includes("•") ? raw : formatCedula(raw)) : "";
        return openDetailLink(
          r,
          <>
            {showsGuardian && <GuardianCedulaIcon />}
            <MaskedValue value={formatted} />
          </>,
        );
      },
    },
    { key: "nss", header: t("patients.nss"), sortKey: "nss", render: (r) => openDetailLink(r, <MaskedValue value={r.nss} />) },
    { key: "phone", header: t("patients.phone"), sortKey: "phone", render: (r) => <MaskedValue value={formatPhone(r.phone)} /> },
    { key: "ars_name", header: t("patients.ars"), sortKey: "ars__name" },
    { key: "ars_program_name", header: t("patients.arsProgram"), sortKey: "ars_program__name" },
    { key: "center_name", header: t("patients.center"), sortKey: "center__code", render: (r) => r.center_code ?? "—" },
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (r: Patient) => (
              <span className={`badge status-${r.active ? "active" : "inactive"}`}>
                {r.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<Patient>,
        ]
      : []),
  ];

  return (
    <Page
      title={t("patients.title")}
      actions={
        <button className="btn primary" onClick={openNew}>
          + {t("patients.new")}
        </button>
      }
    >
      {initialLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="list-toolbar">
            <SearchBar
              value={search}
              onChange={setSearch}
              onSubmit={searchSubmit}
              placeholder={t("common.searchPlaceholder")}
              label={t("common.search")}
            />
            {isAdmin && (
              <label className="show-inactive-toggle">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                {t("common.showInactive")}
              </label>
            )}
          </div>
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          <Table
            columns={columns}
            rows={displayRows}
            onEdit={openEdit}
            onDelete={canDelete ? remove : undefined}
            onRestore={isAdmin ? restore : undefined}
            getRowLabel={(r) => r.full_name}
            isInactive={(r) => !r.active}
            sortKey={clientSort?.key ?? sortKey}
            sortDir={clientSort?.dir ?? sortDir}
            onSort={handleColumnSort}
          />
          <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
        </>
      )}

      {modal && (
        <PatientFormModal
          patient={editingPatient}
          onClose={() => setModal(false)}
          onSaved={() => {
            setModal(false);
            load();
          }}
        />
      )}

      {detail && (
        <Dialog title={<MaskedValue value={detail.full_name} />} onClose={() => setDetail(null)} wide>
          <div className="form-columns">
            <div>
              <h4>{t("patients.sectionIdentity")}</h4>
              <div className="kv-grid">
                <div>
                  <b>{t("patients.cedula")}:</b>{" "}
                  <MaskedValue value={detail.cedula ? (detail.cedula.includes("•") ? detail.cedula : formatCedula(detail.cedula)) : ""} />
                </div>
                <div>
                  <b>{t("patients.birthDate")}:</b> {detail.birth_date ?? "—"}
                </div>
                <div>
                  <b>{t("patients.age")}:</b> {detail.age ?? "—"}
                </div>
                <div>
                  <b>{t("patients.gender")}:</b> {genderLabels[detail.gender] ?? detail.gender}
                </div>
              </div>
            </div>
            <div>
              <h4>{t("patients.sectionInsurance")}</h4>
              <div className="kv-grid">
                <div>
                  <b>{t("patients.nss")}:</b> <MaskedValue value={detail.nss} />
                </div>
                <div>
                  <b>{t("patients.ars")}:</b> {detail.ars_name ?? "—"}
                </div>
                <div>
                  <b>{t("patients.arsProgram")}:</b> {detail.ars_program_name ?? "—"}
                </div>
                <div>
                  <b>{t("patients.center")}:</b> {detail.center_name ?? "—"}
                </div>
              </div>
            </div>
          </div>

          <h4>{t("patients.sectionContact")}</h4>
          <div className="kv-grid">
            <div>
              <b>{t("patients.phone")}:</b> <MaskedValue value={formatPhone(detail.phone)} />
            </div>
            <div>
              <b>{t("common.email")}:</b> <MaskedValue value={detail.email} />
            </div>
            <div>
              <b>{t("patients.address")}:</b> <MaskedValue value={detail.address} />
            </div>
          </div>

          {(detail.age ?? 99) < 18 && (
            <>
              <h4>{t("patients.sectionGuardian")}</h4>
              {detail.has_guardian ? (
                <div className="kv-grid">
                  <div>
                    <b>{t("patients.guardianFirstName")}:</b> <MaskedValue value={detail.guardian_first_name} />
                  </div>
                  <div>
                    <b>{t("patients.guardianLastName")}:</b> <MaskedValue value={detail.guardian_last_name} />
                  </div>
                  <div>
                    <b>{t("patients.guardianCedula")}:</b>{" "}
                    <MaskedValue
                      value={
                        detail.guardian_cedula
                          ? detail.guardian_cedula.includes("•")
                            ? detail.guardian_cedula
                            : formatCedula(detail.guardian_cedula)
                          : ""
                      }
                    />
                  </div>
                  <div>
                    <b>{t("patients.guardianNss")}:</b> <MaskedValue value={detail.guardian_nss} />
                  </div>
                  <div>
                    <b>{t("patients.guardianPhone")}:</b> <MaskedValue value={formatPhone(detail.guardian_phone)} />
                  </div>
                </div>
              ) : (
                <p className="muted">{t("patients.guardianNotOnFile")}</p>
              )}
            </>
          )}

          {(detail.allergies || detail.critical_conditions) && (
            <>
              <h4>{t("patients.sectionClinical")}</h4>
              <div className="kv-grid">
                {detail.allergies && (
                  <div>
                    <b>{t("patients.allergies")}:</b> <MaskedValue value={detail.allergies} />
                  </div>
                )}
                {detail.critical_conditions && (
                  <div>
                    <b>{t("patients.criticalConditions")}:</b>{" "}
                    <MaskedValue value={detail.critical_conditions} />
                  </div>
                )}
              </div>
            </>
          )}

          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setDetail(null)}>
              {t("common.close")}
            </button>
          </div>
        </Dialog>
      )}
    </Page>
  );
}
