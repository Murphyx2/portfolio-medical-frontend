import { useState } from "react";
import { useTranslation } from "react-i18next";

/** Compact display of a doctor's services/rooms inside a table cell: always
 * shows the first `max` items as quiet chips, then a toggle chip that
 * expands/collapses the rest inline -- shared by ServiceChipList/RoomChipList
 * (previously two near-identical copies of this same truncation logic).
 * Renders a muted dash when there are none. */
export function ChipList<T extends { id: number }>({
  items,
  getLabel,
  max = 3,
  moreLabelKey,
}: {
  items: T[];
  getLabel: (item: T) => string;
  max?: number;
  moreLabelKey: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return <span className="muted">{"—"}</span>;
  const visible = items.slice(0, max);
  const overflow = items.slice(max);
  return (
    <span className="service-chip-list">
      {visible.map((item) => (
        <span key={item.id} className="service-chip">
          {getLabel(item)}
        </span>
      ))}
      {overflow.length > 0 && (
        <>
          <button
            type="button"
            className="service-chip service-chip-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t("common.showLess") : t(moreLabelKey, { count: overflow.length })}
            <span className="service-chip-toggle-caret" aria-hidden="true">
              {expanded ? "▴" : "▾"}
            </span>
          </button>
          {expanded && (
            <span className="service-chip-list service-chip-list-overflow">
              {overflow.map((item) => (
                <span key={item.id} className="service-chip">
                  {getLabel(item)}
                </span>
              ))}
            </span>
          )}
        </>
      )}
    </span>
  );
}
