import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListPage } from "../components/ListPage";
import { FormModal, Page, type Column } from "../components/ui";
import { RoleGate } from "../components/guards";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { ARS, ARSProgram } from "../services/types";
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
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const {
    rows,
    page,
    setPage,
    pageSize,
    count,
    search,
    setSearch,
    searchSubmit,
    sortKey,
    sortDir,
    handleSort,
    changePageSize,
    initialLoading,
    showInactive,
    setShowInactive,
    load,
  } = useListPage<ARS>("/ars/");

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
  ];

  return (
    <RoleGate roles={["ADMIN", "RECEPTIONIST"]}>
      <Page
        title={t("ars.title")}
        actions={
          isAdmin && (
            <button className="btn primary" onClick={openNew}>
              + {t("ars.new")}
            </button>
          )
        }
      >
        <ListPage<ARS>
          initialLoading={initialLoading}
          search={search}
          setSearch={setSearch}
          searchSubmit={searchSubmit}
          isAdmin={isAdmin}
          showInactive={showInactive}
          onToggleInactive={setShowInactive}
          page={page}
          count={count}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          columns={columns}
          activeAccessor={(r) => r.active}
          rows={rows}
          onEdit={isAdmin ? openEdit : undefined}
          onDelete={isAdmin ? remove : undefined}
          onRestore={isAdmin ? restore : undefined}
          getRowLabel={(r) => r.name}
          isInactive={(r) => !r.active}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />

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
