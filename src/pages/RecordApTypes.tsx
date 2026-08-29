import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ListPage } from "../components/ListPage";
import { Dialog, Field, FormModal, Page, Table, type Column } from "../components/ui";
import { useListPage } from "../hooks/useListPage";
import { api, ApiError } from "../services/api";
import type { APCategory, APType, Paginated } from "../services/types";
import { useAuth } from "../store/auth";
import { can } from "../utils/can";
import { flattenError } from "../utils/errors";

const EMPTY_TYPE = { name: "", category: 0, sort_order: 0 };
const EMPTY_CATEGORY = { name: "", sort_order: 0 };

/** Manages the AP (Antecedentes Patológicos) catalog admin sees from the
 * Expedientes Médicos page. Structured exactly like Services/ServiceTypes:
 * this page's main list is the "item" level (APType, FK to APCategory),
 * with a secondary modal for the "category" level (APCategory) --
 * Categories management is folded into one modal here rather than a whole
 * second route/page, since AP categories are a short, rarely-edited list. */
export function RecordApTypes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = can(user?.role, "edit", "recordApTypes");
  const isAdmin = can(user?.role, "restore", "recordApTypes");
  const [categories, setCategories] = useState<APCategory[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_TYPE);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [categoriesModal, setCategoriesModal] = useState(false);
  const [quickCategoryModal, setQuickCategoryModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
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
  } = useListPage<APType>("/ap-types/", { extraParams: { category: categoryFilter } });

  function loadCategories() {
    api
      .get<Paginated<APCategory>>("/ap-categories/?page_size=100")
      .then((r) => setCategories(r.results))
      .catch(() => {});
  }

  useEffect(loadCategories, []);

  function openNew() {
    setForm(EMPTY_TYPE);
    setEditId(null);
    setFormError("");
    setModal(true);
  }

  function openEdit(row: APType) {
    setForm({ name: row.name, category: row.category, sort_order: row.sort_order });
    setEditId(row.id);
    setFormError("");
    setModal(true);
  }

  async function submit() {
    setFormError("");
    try {
      const body = { ...form, category: Number(form.category) };
      if (editId) await api.patch(`/ap-types/${editId}/`, body);
      else await api.post("/ap-types/", body);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(row: APType) {
    await api.delete(`/ap-types/${row.id}/`);
    load();
  }

  async function restore(row: APType) {
    await api.post(`/ap-types/${row.id}/restore/`, {});
    load();
  }

  // If the type being edited references a category no longer in the
  // active-only fetched list (deactivated after this type was created),
  // keep it selectable so the form doesn't silently drop it.
  const categoryOptions =
    editId && form.category && !categories.some((c) => c.id === form.category)
      ? [...categories, { id: form.category, name: rows.find((r) => r.id === editId)?.category_name ?? "—", sort_order: 0, active: false }]
      : categories;

  const columns: Column<APType>[] = [
    { key: "name", header: t("recordApTypes.name"), sortKey: "name" },
    { key: "category_name", header: t("recordApTypes.category") },
  ];

  return (
    <Page
      card
      title={t("recordApTypes.title")}
      actions={
        <div className="page-actions-row">
          <button className="btn ghost" onClick={() => navigate("/records")}>
            {t("recordApTypes.back")}
          </button>
          {canEdit && (
            <button className="btn ghost" onClick={() => setCategoriesModal(true)}>
              {t("recordApTypes.manageCategories")}
            </button>
          )}
          {canEdit && (
            <button className="btn primary" onClick={openNew}>
              + {t("recordApTypes.new")}
            </button>
          )}
        </div>
      }
    >
      <ListPage<APType>
        initialLoading={initialLoading}
        search={search}
        setSearch={setSearch}
        searchSubmit={searchSubmit}
        toolbarAfter={
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">{t("recordApTypes.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
        activeAccessor={(row) => row.active}
        rows={rows}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={canEdit ? remove : undefined}
        onRestore={isAdmin ? restore : undefined}
        getRowLabel={(row) => row.name}
        isInactive={(row) => !row.active}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {modal && (
        <FormModal
          title={editId ? t("common.edit") : t("recordApTypes.new")}
          onClose={() => setModal(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("recordApTypes.name")}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t("recordApTypes.category")}>
            <div className="inline-field-with-action">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: Number(e.target.value) })}
                required
              >
                <option value={0} disabled>—</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button type="button" className="btn ghost small" onClick={() => setQuickCategoryModal(true)}>
                + {t("recordApTypes.newCategory")}
              </button>
            </div>
          </Field>
          {editId && (
            <Field label={t("recordApTypes.sortOrder")}>
              <input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </Field>
          )}
        </FormModal>
      )}

      {categoriesModal && (
        <CategoriesModal
          categories={categories}
          onClose={() => setCategoriesModal(false)}
          onChanged={loadCategories}
          isAdmin={isAdmin}
        />
      )}

      {quickCategoryModal && (
        <CategoriesModal
          categories={categories}
          onClose={() => setQuickCategoryModal(false)}
          onChanged={loadCategories}
          onCreated={(created) => setForm((f) => ({ ...f, category: created.id }))}
        />
      )}
    </Page>
  );
}

/** Flat, non-paginated CRUD for APCategory -- the list is short (spec's
 * seeded catalog has 9 categories) and rarely edited, so a plain Table
 * inside one Dialog (no ListPage/pagination) is enough. */
function CategoriesModal({
  categories,
  onClose,
  onChanged,
  onCreated,
  isAdmin,
}: {
  categories: APCategory[];
  onClose: () => void;
  onChanged: () => void;
  /** When provided, this modal is being opened as a quick-add from inside
   * the AP Type form rather than the standalone "manage categories" flow --
   * a successful create hands the new category back to the caller (to
   * auto-select it) and closes this modal immediately instead of staying
   * open on the category list. */
  onCreated?: (category: APCategory) => void;
  /** Admin-only show-inactive toggle + restore action. Not needed in the
   * quick-add flow (onCreated set), where the list/toggle never render. */
  isAdmin?: boolean;
}) {
  const { t } = useTranslation();
  // Quick-add mode (onCreated set) skips the category list and opens
  // straight into the add form -- the caller only wants one new category.
  const [formOpen, setFormOpen] = useState(Boolean(onCreated));
  const [form, setForm] = useState(EMPTY_CATEGORY);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  // Own fetch (rather than always reusing the parent's active-only
  // `categories` prop) so toggling "show inactive" here doesn't leak
  // inactive rows into the AP Type form's category dropdown, which must
  // stay active-only. Falls back to the parent's list until this modal's
  // own first fetch resolves.
  const [ownCategories, setOwnCategories] = useState<APCategory[] | null>(null);

  function loadOwn() {
    api
      .get<Paginated<APCategory>>(
        `/ap-categories/?page_size=100${showInactive ? "&include_inactive=true" : ""}`,
      )
      .then((r) => setOwnCategories(r.results))
      .catch(() => {});
  }

  useEffect(loadOwn, [showInactive]);

  function openNew() {
    setForm(EMPTY_CATEGORY);
    setEditId(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(row: APCategory) {
    setForm({ name: row.name, sort_order: row.sort_order });
    setEditId(row.id);
    setFormError("");
    setFormOpen(true);
  }

  async function submit() {
    setFormError("");
    try {
      if (editId) {
        await api.patch(`/ap-categories/${editId}/`, form);
        setFormOpen(false);
        onChanged();
        loadOwn();
      } else {
        const created = await api.post<APCategory>("/ap-categories/", form);
        onChanged();
        loadOwn();
        if (onCreated) {
          onCreated(created);
          onClose();
        } else {
          setFormOpen(false);
        }
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? flattenError(err.message) : String(err));
    }
  }

  async function remove(row: APCategory) {
    await api.delete(`/ap-categories/${row.id}/`);
    onChanged();
    loadOwn();
  }

  async function restore(row: APCategory) {
    await api.post(`/ap-categories/${row.id}/restore/`, {});
    onChanged();
    loadOwn();
  }

  const columns: Column<APCategory>[] = [
    { key: "name", header: t("recordApTypes.name") },
    { key: "sort_order", header: t("recordApTypes.sortOrder") },
  ];

  return (
    <Dialog title={t("recordApTypes.categoriesTitle")} onClose={onClose} wide>
      <div className="page-actions-stack" style={{ marginBottom: "0.75rem" }}>
        <button className="btn primary small" onClick={openNew}>
          + {t("recordApTypes.newCategory")}
        </button>
        {isAdmin && !onCreated && (
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
      <Table<APCategory>
        columns={columns}
        rows={ownCategories ?? categories}
        onEdit={openEdit}
        onDelete={remove}
        onRestore={isAdmin && !onCreated ? restore : undefined}
        getRowLabel={(row) => row.name}
        isInactive={(row) => !row.active}
      />

      {formOpen && (
        <FormModal
          title={editId ? t("common.edit") : t("recordApTypes.newCategory")}
          onClose={() => setFormOpen(false)}
          onSubmit={submit}
          submitLabel={t("common.save")}
          error={formError}
        >
          <Field label={t("recordApTypes.name")}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          {editId && (
            <Field label={t("recordApTypes.sortOrder")}>
              <input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </Field>
          )}
        </FormModal>
      )}
    </Dialog>
  );
}
