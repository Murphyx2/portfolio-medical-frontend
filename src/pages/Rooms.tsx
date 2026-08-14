import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Field, FormModal, Page, Pagination, SearchBar, Spinner, Table, type Column } from "../components/ui";
import { useListControls } from "../hooks/useListControls";
import { api, ApiError } from "../services/api";
import type { MedicalCenter, Paginated, Room, RoomType } from "../services/types";
import { useAuth } from "../store/auth";
import { flattenError } from "../utils/errors";

const ROOM_TYPES: RoomType[] = ["CONSULTATION", "PROCEDURE", "LABORATORY", "IMAGING", "WAITING", "OTHER"];

const EMPTY = {
  code: "",
  name: "",
  room_type: "CONSULTATION" as RoomType,
  center: 0,
  floor_area: "",
  capacity: "",
  notes: "",
};

export function Rooms() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canCreate = user?.role === "ADMIN" || user?.role === "IT";
  const canEdit = canCreate || user?.role === "RECEPTIONIST";
  const canDelete = canCreate;
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<Room[]>([]);
  const [centers, setCenters] = useState<MedicalCenter[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [centerFilter, setCenterFilter] = useState("");
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

  const qs = query({
    include_inactive: showInactive ? "true" : "",
    room_type: typeFilter,
    center: centerFilter,
  });

  const load = useCallback(() => {
    runList((signal) => api.get<Paginated<Room>>(`/rooms/?${qs}`, { signal }))
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

  useEffect(() => {
    api.get<Paginated<MedicalCenter>>("/centers/?page_size=100").then((r) => setCenters(r.results)).catch(() => {});
  }, []);

  const roomTypeLabel = (rt: RoomType) => t(`rooms.type${rt[0]}${rt.slice(1).toLowerCase()}`);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(r: Room) {
    setForm({
      code: r.code,
      name: r.name,
      room_type: r.room_type,
      center: r.center,
      floor_area: r.floor_area,
      capacity: r.capacity === null ? "" : String(r.capacity),
      notes: r.notes,
    });
    setEditId(r.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    try {
      const payload = {
        code: form.code,
        name: form.name,
        room_type: form.room_type,
        center: Number(form.center),
        floor_area: form.floor_area,
        capacity: form.capacity === "" ? null : Number(form.capacity),
        notes: form.notes,
      };
      if (editId) await api.patch(`/rooms/${editId}/`, payload);
      else await api.post("/rooms/", payload);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(r: Room) {
    await api.delete(`/rooms/${r.id}/`);
    load();
  }

  async function restore(r: Room) {
    await api.post(`/rooms/${r.id}/restore/`, {});
    load();
  }

  const columns: Column<Room>[] = [
    { key: "code", header: t("rooms.code"), sortKey: "code" },
    { key: "name", header: t("rooms.name"), sortKey: "name" },
    { key: "room_type", header: t("rooms.type"), sortKey: "room_type", render: (r) => roomTypeLabel(r.room_type) },
    { key: "center_name", header: t("rooms.center"), sortKey: "center__name" },
    { key: "floor_area", header: t("rooms.floorArea"), sortKey: "floor_area" },
    { key: "capacity", header: t("rooms.capacity"), sortKey: "capacity", render: (r) => r.capacity ?? "—" },
    ...(isAdmin
      ? [
          {
            key: "active",
            header: t("common.status"),
            render: (r: Room) => (
              <span className={`badge status-${r.active ? "active" : "inactive"}`}>
                {r.active ? t("common.active") : t("common.inactive")}
              </span>
            ),
          } as Column<Room>,
        ]
      : []),
  ];

  return (
    <Page
      title={t("rooms.title")}
      actions={
        canCreate && (
          <button className="btn primary" onClick={openNew}>
            + {t("rooms.new")}
          </button>
        )
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
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{t("rooms.allTypes")}</option>
              {ROOM_TYPES.map((rt) => (
                <option key={rt} value={rt}>{roomTypeLabel(rt)}</option>
              ))}
            </select>
            <select value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)}>
              <option value="">{t("rooms.allCenters")}</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
            onEdit={canEdit ? openEdit : undefined}
            onDelete={canDelete ? remove : undefined}
            onRestore={isAdmin ? restore : undefined}
            getRowLabel={(r) => r.name || r.code}
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
          title={editId ? t("common.edit") : t("rooms.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("rooms.code")}>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </Field>
          <Field label={t("rooms.name")}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t("rooms.type")}>
            <select value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value as RoomType })}>
              {ROOM_TYPES.map((rt) => (
                <option key={rt} value={rt}>{roomTypeLabel(rt)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("rooms.center")}>
            <select value={form.center} onChange={(e) => setForm({ ...form, center: Number(e.target.value) })} required>
              <option value={0} disabled>—</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("rooms.floorArea")}>
            <input value={form.floor_area} onChange={(e) => setForm({ ...form, floor_area: e.target.value })} />
          </Field>
          <Field label={t("rooms.capacity")}>
            <input
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </Field>
          <Field label={t("rooms.notes")}>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </FormModal>
      )}
    </Page>
  );
}
