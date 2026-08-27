import { useTranslation } from "react-i18next";

import { ListPage } from "../../components/ListPage";
import { MaskedValue, type Column, type SortDir } from "../../components/ui";
import type { MedicalRecord } from "../../services/types";
import { formatCedula } from "../../utils/cedula";
import { formatDateTime } from "../../utils/date";

/** Records list: toolbar/table/columns, wired onto F1's `ListPage` shell.
 * Records does NOT run a custom confirm-action flow (unlike Encounters) --
 * delete/restore go straight through `ListPage`/`Table`'s built-in confirm,
 * so this component only needs the column defs and a click-to-open launcher
 * per identifying column (patient/cedula/nss), plus the "Nueva entrada" row
 * action (spec §5) as an extra column ahead of Table's own Acciones column. */
export function RecordList({
  initialLoading,
  search,
  setSearch,
  searchSubmit,
  isAdmin,
  showInactive,
  onToggleInactive,
  page,
  count,
  pageSize,
  onPageChange,
  onPageSizeChange,
  rows,
  onDelete,
  onRestore,
  sortKey,
  sortDir,
  onSort,
  openDetail,
  canCreateEntry,
}: {
  initialLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  searchSubmit: () => void;
  isAdmin: boolean;
  showInactive: boolean;
  onToggleInactive: (value: boolean) => void;
  page: number;
  count: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  rows: MedicalRecord[];
  onDelete?: (row: MedicalRecord) => void | Promise<void>;
  onRestore?: (row: MedicalRecord) => void | Promise<void>;
  sortKey: string | null;
  sortDir: SortDir | null;
  onSort: (key: string) => void;
  openDetail: (rec: MedicalRecord, opts?: { newEntry?: boolean }) => void;
  canCreateEntry: boolean;
}) {
  const { t } = useTranslation();

  const columns: Column<MedicalRecord>[] = [
    {
      key: "full_name",
      header: t("records.patient"),
      sortKey: "patient__search_name",
      render: (r) => (
        <button type="button" className="row-link" onClick={() => openDetail(r)}>
          <MaskedValue value={r.patient_info.full_name} />
        </button>
      ),
    },
    {
      key: "cedula",
      header: t("patients.cedula"),
      render: (r) => (
        <button type="button" className="row-link" onClick={() => openDetail(r)}>
          <MaskedValue
            value={
              r.patient_info.cedula
                ? r.patient_info.cedula.includes("•")
                  ? r.patient_info.cedula
                  : formatCedula(r.patient_info.cedula)
                : ""
            }
          />
        </button>
      ),
    },
    {
      key: "nss",
      header: t("patients.nss"),
      render: (r) => (
        <button type="button" className="row-link" onClick={() => openDetail(r)}>
          <MaskedValue value={r.patient_info.nss} />
        </button>
      ),
    },
    {
      key: "last_visit_at",
      header: t("records.lastVisit"),
      sortKey: "last_visit_at",
      render: (r) => (r.last_visit_at ? formatDateTime(r.last_visit_at) : t("records.noRecordShort")),
    },
    { key: "created_by_name", header: t("records.createdBy"), sortKey: "created_by__username" },
    ...(canCreateEntry
      ? [
          {
            key: "newEntry",
            header: "",
            align: "center" as const,
            render: (r: MedicalRecord) => (
              <button type="button" className="btn ghost small" onClick={() => openDetail(r, { newEntry: true })}>
                {t("records.newEntry")}
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <ListPage<MedicalRecord>
      initialLoading={initialLoading}
      search={search}
      setSearch={setSearch}
      searchSubmit={searchSubmit}
      isAdmin={isAdmin}
      showInactive={showInactive}
      onToggleInactive={onToggleInactive}
      page={page}
      count={count}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      columns={columns}
      activeAccessor={(r) => r.active}
      rows={rows}
      onDelete={onDelete}
      onRestore={onRestore}
      getRowLabel={(r) => r.patient_info.full_name}
      isInactive={(r) => !r.active}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
    />
  );
}
