import { useTranslation } from "react-i18next";

import { ListPage } from "../../components/ListPage";
import { MaskedValue, type Column, type SortDir } from "../../components/ui";
import type { MedicalRecord } from "../../services/types";
import { formatCedula } from "../../utils/cedula";

/** Records list: toolbar/table/columns, wired onto F1's `ListPage` shell.
 * Records does NOT run a custom confirm-action flow (unlike Encounters) --
 * delete/restore go straight through `ListPage`/`Table`'s built-in confirm,
 * so this component only needs the column defs and a click-to-detail
 * launcher per identifying column (patient/cedula/nss). */
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
  openingId,
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
  openDetail: (rec: MedicalRecord) => void;
  openingId: number | null;
}) {
  const { t } = useTranslation();

  const columns: Column<MedicalRecord>[] = [
    {
      key: "full_name",
      header: t("records.patient"),
      sortKey: "patient__search_name",
      render: (r) => (
        <button type="button" className="row-link" disabled={openingId === r.id} onClick={() => openDetail(r)}>
          {openingId === r.id ? t("common.loading") : <MaskedValue value={r.patient_info.full_name} />}
        </button>
      ),
    },
    {
      key: "cedula",
      header: t("patients.cedula"),
      render: (r) => (
        <button type="button" className="row-link" disabled={openingId === r.id} onClick={() => openDetail(r)}>
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
        <button type="button" className="row-link" disabled={openingId === r.id} onClick={() => openDetail(r)}>
          <MaskedValue value={r.patient_info.nss} />
        </button>
      ),
    },
    { key: "title", header: t("records.recordTitle"), sortKey: "title" },
    { key: "date", header: t("records.date"), sortKey: "date", render: (r) => new Date(r.date).toLocaleString() },
    { key: "created_by_name", header: t("records.doctor"), sortKey: "created_by__username" },
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
