import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChipList } from "../../components/ChipList";
import { SearchBar } from "../../components/ui";
import { toSentenceCase } from "../../utils/text";

/** Compact display of a doctor's assigned rooms inside a table cell -- thin
 * wrapper around the shared ChipList, mirrors ServiceChipList. */
export function RoomChipList({ items, max = 3 }: { items: { id: number; name: string }[]; max?: number }) {
  return <ChipList items={items} max={max} getLabel={(r) => r.name} moreLabelKey="doctors.moreRooms" />;
}

interface RoomPickItem {
  id: number;
  code: string;
  name: string;
  room_type: number;
  room_type_name: string;
  center_name: string;
}

/** Shared "pick from active rooms" checkbox list, used by both the Doctors
 * create/edit form (ADMIN) and the standalone "manage rooms" action
 * (ADMIN/CENTER_MANAGER) -- mirrors ServiceCheckboxList's shape exactly.
 *
 * Owns its own live search + room-type filter (client-side -- the rooms
 * list is already fully fetched, so no server round-trip is needed);
 * filtering only affects what's *displayed*, never `selected`, so a
 * doctor's already-assigned room is never silently dropped just because it
 * scrolled out of the current search/filter view. */
export function RoomCheckboxList({
  rooms,
  selected,
  onChange,
}: {
  rooms: RoomPickItem[];
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
    rooms.forEach((r) => seen.set(r.room_type, r.room_type_name));
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [rooms]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (typeFilter && String(r.room_type) !== typeFilter) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.room_type_name.toLowerCase().includes(q) ||
        r.center_name.toLowerCase().includes(q)
      );
    });
  }, [rooms, search, typeFilter]);

  if (!rooms.length) return <p className="muted">{t("doctors.noRooms")}</p>;
  return (
    <div>
      <div className="list-toolbar service-picker-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder={t("common.searchPlaceholder")} label={t("common.search")} />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={t("doctors.filterByRoomType")}
        >
          <option value="">{t("doctors.allRoomTypes")}</option>
          {types.map((ty) => (
            <option key={ty.id} value={ty.id}>
              {toSentenceCase(ty.name)}
            </option>
          ))}
        </select>
      </div>
      <div className="service-checkbox-list">
        {filtered.length === 0 && <p className="muted">{t("doctors.noRoomsMatch")}</p>}
        {filtered.map((r) => (
          <label key={r.id} className="service-checkbox-row">
            <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
            <span className="service-checkbox-info">
              <span>
                {r.name} <span className="service-checkbox-simon">#{r.code}</span>
              </span>
              <span className="cell-sublabel">{toSentenceCase(r.room_type_name)} · {r.center_name}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
