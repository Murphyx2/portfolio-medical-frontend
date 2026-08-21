import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SearchBar } from "../../components/ui";
import { toSentenceCase } from "../../utils/text";

/** Compact display of a doctor's offered services inside a table cell: up to
 * `max` quiet chips, then a single muted "+N" overflow chip carrying a
 * native title tooltip with the rest -- keeps a long list from turning the
 * row into a wall of tags. Renders a muted dash when there are none. */
export function ServiceChipList({ items, max = 3 }: { items: { id: number; name: string }[]; max?: number }) {
  const { t } = useTranslation();
  if (!items.length) return <span className="muted">{"—"}</span>;
  const visible = items.slice(0, max);
  const overflow = items.slice(max);
  return (
    <span className="service-chip-list">
      {visible.map((s) => (
        <span key={s.id} className="service-chip">
          {toSentenceCase(s.name)}
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          className="service-chip service-chip-overflow"
          title={overflow.map((s) => toSentenceCase(s.name)).join(", ")}
        >
          {t("doctors.moreServices", { count: overflow.length })}
        </span>
      )}
    </span>
  );
}

interface ServicePickItem {
  id: number;
  simon: string;
  name: string;
  type: number;
  type_name: string;
}

/** Shared "pick from active services" checkbox list, used by both the
 * Doctors create/edit form (ADMIN) and the standalone "manage services"
 * action (ADMIN/CENTER_MANAGER) -- one implementation of the picker, two
 * entry points, since those two roles reach it through different surfaces.
 *
 * Owns its own live search + type filter (client-side -- the services list
 * is already fully fetched, so no server round-trip is needed); filtering
 * only affects what's *displayed*, never `selected`, so a doctor's already-
 * chosen service is never silently dropped just because it scrolled out of
 * the current search/filter view. */
export function ServiceCheckboxList({
  services,
  selected,
  onChange,
}: {
  services: ServicePickItem[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const types = useMemo(() => {
    const seen = new Map<number, string>();
    services.forEach((s) => seen.set(s.type, s.type_name));
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (typeFilter && String(s.type) !== typeFilter) return false;
      if (!q) return true;
      return (
        s.simon.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.type_name.toLowerCase().includes(q)
      );
    });
  }, [services, search, typeFilter]);

  if (!services.length) return <p className="muted">{t("doctors.noServices")}</p>;
  return (
    <div>
      <div className="list-toolbar service-picker-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder={t("common.searchPlaceholder")} label={t("common.search")} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t("doctors.allServiceTypes")}</option>
          {types.map((ty) => (
            <option key={ty.id} value={ty.id}>
              {toSentenceCase(ty.name)}
            </option>
          ))}
        </select>
      </div>
      <div className="service-checkbox-list">
        {filtered.length === 0 && <p className="muted">{t("doctors.noServicesMatch")}</p>}
        {filtered.map((s) => (
          <label key={s.id} className="service-checkbox-row">
            <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
            <span className="service-checkbox-info">
              <span>
                {toSentenceCase(s.name)} <span className="service-checkbox-simon">#{s.simon}</span>
              </span>
              <span className="cell-sublabel">{toSentenceCase(s.type_name)}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
