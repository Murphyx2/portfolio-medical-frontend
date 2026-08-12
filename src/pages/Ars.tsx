import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { RoleGate } from "../components/guards";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { ARS, ARSProgram, Paginated } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";

interface ProgramDraft {
  id?: number;
  name: string;
}

const EMPTY: { ars_id: string; name: string; programs: ProgramDraft[] } = {
  ars_id: "",
  name: "",
  programs: [],
};

export function Ars() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<ARS[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
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
    runList((signal) => api.get<Paginated<ARS>>(`/ars/?${qs}`, { signal }))
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

  function openNew() {
    setForm({ ...EMPTY });
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(a: ARS) {
    setForm({
      ars_id: a.ars_id,
      name: a.name,
      programs: a.programs.map((p: ARSProgram) => ({ id: p.id, name: p.name })),
    });
    setEditId(a.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    const body = {
      ars_id: form.ars_id,
      name: form.name,
      programs: form.programs.map((p) => ({ id: p.id, name: p.name })),
    };
    try {
      if (editId) await api.patch(`/ars/${editId}/`, body);
      else await api.post("/ars/", body);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(a: ARS) {
    await api.delete(`/ars/${a.id}/`);
    load();
  }

  async function restore(a: ARS) {
    await api.post(`/ars/${a.id}/restore/`, {});
    load();
  }

  const columns: Column<ARS>[] = [
    { key: "ars_id", header: t("ars.arsId"), sortKey: "ars_id" },
    { key: "name", header: t("ars.name"), sortKey: "name" },
    {
      key: "programs",
      header: t("ars.programs"),
      render: (r) => r.programs.map((p) => p.name).join(", "),
    },
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (r: ARS) => (
              <span className={`badge status-${r.active ? "active" : "inactive"}`}>
                {r.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<ARS>,
        ]
      : []),
  ];

  return (
    <RoleGate roles={["ADMIN", "RECEPTIONIST"]}>
      <Page
        title={t("ars.title")}
        actions={
          <button className="btn primary" onClick={openNew}>
            + {t("ars.new")}
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
              rows={rows}
              onEdit={openEdit}
              onDelete={remove}
              onRestore={isAdmin ? restore : undefined}
              getRowLabel={(r) => r.name}
              isInactive={(r) => !r.active}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <Pagination page={page} count={count} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize} />
          </>
        )}

        {modal && (
          <FormModal
            title={editId ? t("common.edit") : t("ars.new")}
            onClose={() => setModal(false)}
            onSubmit={submit}
            submitLabel={t("common.save")}
            error={formError}
          >
            <label className="field">
              <span>{t("ars.arsId")}</span>
              <input
                value={form.ars_id}
                onChange={(e) => setForm({ ...form, ars_id: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>{t("ars.name")}</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <div className="field">
              <span>{t("ars.programs")}</span>
              <div className="program-editor">
                {form.programs.map((p, idx) => (
                  <div className="program-row" key={idx}>
                    <input
                      value={p.name}
                      placeholder={t("ars.programName")}
                      onChange={(e) => {
                        const next = [...form.programs];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setForm({ ...form, programs: next });
                      }}
                    />
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() =>
                        setForm({
                          ...form,
                          programs: form.programs.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setForm({ ...form, programs: [...form.programs, { name: "" }] })}
                >
                  + {t("ars.addProgram")}
                </button>
              </div>
            </div>
          </FormModal>
        )}
      </Page>
    </RoleGate>
  );
}
