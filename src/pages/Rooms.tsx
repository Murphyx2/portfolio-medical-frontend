import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ListPage } from "../components/ListPage";
import { Field, FormModal, Page, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { Paginated, Room, RoomType } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";

const EMPTY = {
  code: "",
  name: "",
  room_type: 0,
  floor_area: "",
  capacity: "",
  notes: "",
};

export function Rooms() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = can(user?.role, "create", "rooms");
  const canEdit = can(user?.role, "edit", "rooms");
  const canDelete = can(user?.role, "delete", "rooms");
  const isAdmin = can(user?.role, "restore", "rooms");
  const [types, setTypes] = useState<RoomType[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
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
  } = useListPage<Room>("/rooms/", { extraParams: { room_type: typeFilter } });

  useEffect(() => {
    // Type options: fetched once, not on every page/sort/search change.
    api.get<Paginated<RoomType>>("/room-types/?page_size=100").then((r) => setTypes(r.results)).catch(() => {});
  }, []);

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
        room_type: Number(form.room_type),
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

  // If the room being edited references a type no longer in the active-only
  // fetched list (deactivated after the room was created), keep it
  // selectable so the form doesn't silently drop it.
  const typeOptions =
    editId && form.room_type && !types.some((ty) => ty.id === form.room_type)
      ? [...types, { id: form.room_type, name: rows.find((r) => r.id === editId)?.room_type_name ?? "—", active: false }]
      : types;

  const columns: Column<Room>[] = [
    { key: "code", header: t("rooms.code"), sortKey: "code" },
    { key: "name", header: t("rooms.name"), sortKey: "name" },
    { key: "room_type_name", header: t("rooms.type"), sortKey: "room_type__name" },
    { key: "center_name", header: t("rooms.center"), sortKey: "center__name" },
    { key: "floor_area", header: t("rooms.floorArea"), sortKey: "floor_area" },
    { key: "capacity", header: t("rooms.capacity"), sortKey: "capacity", render: (r) => r.capacity ?? "—" },
  ];

  return (
    <Page
      title={t("rooms.title")}
      actions={
        canCreate && (
          <div className="page-actions-stack">
            <button className="btn primary" onClick={openNew}>
              + {t("rooms.new")}
            </button>
            <button className="btn ghost" onClick={() => navigate("/rooms/types")}>
              {t("rooms.manageTypes")}
            </button>
          </div>
        )
      }
    >
      <ListPage<Room>
        initialLoading={initialLoading}
        search={search}
        setSearch={setSearch}
        searchSubmit={searchSubmit}
        toolbarAfter={
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{t("rooms.allTypes")}</option>
            {types.map((ty) => (
              <option key={ty.id} value={ty.id}>{ty.name}</option>
            ))}
          </select>
        }
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
        onEdit={canEdit ? openEdit : undefined}
        onDelete={canDelete ? remove : undefined}
        onRestore={isAdmin ? restore : undefined}
        getRowLabel={(r) => r.name || r.code}
        isInactive={(r) => !r.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("rooms.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("rooms.code")}>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
          </Field>
          <Field label={t("rooms.name")}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
              required
            />
          </Field>
          <Field label={t("rooms.type")}>
            <select
              value={form.room_type}
              onChange={(e) => setForm({ ...form, room_type: Number(e.target.value) })}
              required
            >
              <option value={0} disabled>—</option>
              {typeOptions.map((ty) => (
                <option key={ty.id} value={ty.id}>{ty.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("rooms.floorArea")}>
            <input
              value={form.floor_area}
              onChange={(e) => setForm({ ...form, floor_area: e.target.value.toUpperCase() })}
            />
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
