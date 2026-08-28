import { describe, expect, it } from "vitest";
import { Hospital, Settings } from "lucide-react";

import { NAV_FOOT, NAV_GROUPS, filterGroups, filterItems } from "./Layout";
import { can } from "../utils/can";

describe("sidebar nav grouping", () => {
  it("preserves RBAC parity with a flat can() filter, per role", () => {
    const flatItems = NAV_GROUPS.flatMap((g) => g.items).concat(NAV_FOOT);
    (["ADMIN", "DOCTOR", "RECEPTIONIST", "IT", "NURSE", "CENTER_MANAGER"] as const).forEach((role) => {
      const grouped = filterGroups(NAV_GROUPS, role)
        .flatMap((g) => g.items)
        .concat(filterItems(NAV_FOOT, role))
        .map((i) => i.to)
        .sort();
      const flat = flatItems
        .filter((item) => !item.resource || can(role, "view", item.resource))
        .map((i) => i.to)
        .sort();
      expect(grouped).toEqual(flat);
    });
  });

  it("hides a group entirely once every item in it is filtered out", () => {
    const groups = [
      { titleKey: "test.group", items: [{ to: "/centers", key: "nav.centers", resource: "centers" as const, icon: Hospital }] },
    ];
    // DOCTOR can't view "centers" (ADMIN/CENTER_MANAGER only) -- the whole
    // group, title included, must disappear rather than render empty.
    expect(filterGroups(groups, "DOCTOR")).toEqual([]);
    expect(filterGroups(groups, "ADMIN")).toHaveLength(1);
  });

  it("keeps Configuración in the foot region, never in a titled group", () => {
    expect(NAV_FOOT.some((item) => item.to === "/settings")).toBe(true);
    expect(NAV_GROUPS.some((group) => group.items.some((item) => item.to === "/settings"))).toBe(false);
  });

  it("keeps a no-resource item (e.g. an unrestricted icon) visible for every role", () => {
    const items = [{ to: "/free", key: "x", icon: Settings }];
    expect(filterItems(items, "NURSE")).toHaveLength(1);
    expect(filterItems(items, undefined)).toHaveLength(1);
  });
});
