/**
 * Regression tests for the drag-release-safe modal backdrop close
 * (frontend commits b74e49c / 5840710).
 *
 * Spec: a modal only closes when the pointer press STARTED on the empty
 * backdrop; right-click on the backdrop is inert.
 *
 * Cases:
 *  1. press+release on the backdrop -> closes
 *  2. press inside the modal, release on the backdrop (drag-release) -> stays open
 *  3. right-button press on the backdrop (no `click` in browsers) -> stays open
 *  4. press inside the modal, release inside the modal -> stays open
 *  5. [bug repro] stale backdrop press (interrupted) + later press inside the
 *     modal + release on backdrop -> currently CLOSES (spec says it must not)
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormModal, MaskedValue, Pagination, SearchableSelect, SearchBar, Table } from "./ui";

function renderModal(onClose = vi.fn()) {
  const utils = render(
    <FormModal title="Test modal" onClose={onClose} onSubmit={() => {}} submitLabel="Save">
      <div id="modal-content">content</div>
    </FormModal>,
  );
  const backdrop = document.querySelector(".modal-backdrop") as HTMLElement;
  const modal = document.querySelector(".modal") as HTMLElement;
  const content = document.querySelector("#modal-content") as HTMLElement;
  return { ...utils, onClose, backdrop, modal, content };
}

describe("FormModal backdrop close", () => {
  it("closes when the press starts and ends on the empty backdrop", () => {
    const { backdrop, onClose } = renderModal();
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT close on drag-release: press starts inside the modal, release on the backdrop", () => {
    const { content, backdrop, onClose } = renderModal();
    fireEvent.pointerDown(content);
    fireEvent.click(backdrop); // release over the backdrop after dragging out
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT close when the press starts inside the modal", () => {
    const { content, onClose } = renderModal();
    fireEvent.pointerDown(content);
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT close on a right-button press over the backdrop (no click event fires)", () => {
    const { backdrop, onClose } = renderModal();
    // Right-click sequence in browsers: pointerdown(button=2) + contextmenu.
    fireEvent.pointerDown(backdrop, { button: 2, buttons: 2 });
    fireEvent.contextMenu(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes via the Cancel button regardless of where the press started", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("BUG REPRO (stale backdrop press): interrupted press on backdrop, then press inside modal + release on backdrop should NOT close, but currently does", () => {
    const { backdrop, content, onClose } = renderModal();
    // press on backdrop but release outside the window (pointerup never lands
    // on the backdrop, so no click, ref stays true)
    fireEvent.pointerDown(backdrop);
    // next interaction: press starts INSIDE the modal...
    fireEvent.pointerDown(content);
    // ...and is released over the backdrop
    fireEvent.click(backdrop);
    // Spec: the press started inside the modal, so the modal must stay open.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("translates the shared Table chrome (Actions header, Edit/Delete buttons, empty state)", () => {
    const rows = [
      { id: 1, name: "Ana" },
      { id: 2, name: "Luis" },
    ];
    render(
      <Table
        columns={[{ key: "name", header: "Nombre" }]}
        rows={rows}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Eliminar" })).toHaveLength(2);
  });

  it("renders an alert banner when an error is passed to the form", () => {
    render(
      <FormModal
        title="Test modal"
        onClose={() => {}}
        onSubmit={() => {}}
        submitLabel="Save"
        error={"nss: digits only"}
      >
        <div>content</div>
      </FormModal>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("nss: digits only");
  });

  it("renders the empty-state label translated when no rows", () => {
    render(<Table columns={[{ key: "name", header: "Nombre" }]} rows={[]} />);
    expect(screen.getByText("No se encontraron datos")).toBeInTheDocument();
  });
});

describe("MaskedValue", () => {
  it("renders a plain (unmasked) value with no icon or tooltip", () => {
    render(<MaskedValue value="(809) 555-1212" />);
    expect(screen.getByText("(809) 555-1212")).toBeInTheDocument();
    expect(screen.queryByTitle("Oculto para tu rol")).not.toBeInTheDocument();
  });

  it("renders a lock affordance with a role-explanation tooltip for masked values", () => {
    render(<MaskedValue value="80••••00" />);
    expect(screen.getByText("80••••00")).toBeInTheDocument();
    expect(screen.getByTitle("Oculto para tu rol")).toBeInTheDocument();
  });

  it("renders an em dash for empty/null values", () => {
    render(<MaskedValue value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("shows only the page-size selector when there is a single page", () => {
    const { container } = render(
      <Pagination page={1} count={50} pageSize={100} onChange={() => {}} />,
    );
    expect(container.querySelector(".pagination")).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Elementos por página" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anterior" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
  });

  it("defaults to 50 items per page and offers 50/75/100", () => {
    render(<Pagination page={1} count={150} pageSize={50} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: "Elementos por página" }) as HTMLSelectElement;
    expect(select.value).toBe("50");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["50", "75", "100"]);
    expect(screen.getByText("50 por página")).toBeInTheDocument();
    expect(screen.getByText("75 por página")).toBeInTheDocument();
    expect(screen.getByText("100 por página")).toBeInTheDocument();
  });

  it("calls onPageSizeChange with the chosen page size", () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination page={1} count={150} pageSize={50} onChange={() => {}} onPageSizeChange={onPageSizeChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Elementos por página" }), {
      target: { value: "75" },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(75);
  });

  it("shows prev/next, page numbers and the page info when multiple pages", () => {
    render(<Pagination page={2} count={150} pageSize={100} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
    expect(screen.getByText(/150 registros/)).toBeInTheDocument();
  });

  it("disables prev on the first page and next on the last page", () => {
    render(<Pagination page={1} count={150} pageSize={100} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).not.toBeDisabled();
  });

  it("calls onChange with the clicked page number", () => {
    const onChange = vi.fn();
    render(<Pagination page={1} count={250} pageSize={100} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("collapses long page ranges with ellipses and highlights the current page", () => {
    render(<Pagination page={4} count={800} pageSize={100} onChange={() => {}} />);
    expect(screen.getAllByText("…")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8" })).toBeInTheDocument();
    expect(screen.getByText(/Página 4 de 8/)).toBeInTheDocument();
  });
});

describe("Table sorting", () => {
  const sortableColumns = [{ key: "name", header: "Nombre", sortKey: "name" }];

  it("renders a sort button with the neutral arrow and aria-sort=none for sortable columns", () => {
    render(<Table columns={sortableColumns} rows={[]} onSort={() => {}} />);
    const th = screen.getByRole("columnheader", { name: /Nombre/ });
    expect(th.getAttribute("aria-sort")).toBe("none");
    expect(screen.getByText("↕")).toBeInTheDocument();
  });

  it("calls onSort with the column sortKey when the header is clicked", () => {
    const onSort = vi.fn();
    render(<Table columns={sortableColumns} rows={[]} onSort={onSort} />);
    fireEvent.click(screen.getByRole("button", { name: /Nombre/ }));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("shows the ascending arrow and aria-sort=ascending when actively sorted asc", () => {
    render(<Table columns={sortableColumns} rows={[]} sortKey="name" sortDir="asc" onSort={() => {}} />);
    const th = screen.getByRole("columnheader", { name: /Nombre/ });
    expect(th.getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("shows the descending arrow and aria-sort=descending when actively sorted desc", () => {
    render(<Table columns={sortableColumns} rows={[]} sortKey="name" sortDir="desc" onSort={() => {}} />);
    const th = screen.getByRole("columnheader", { name: /Nombre/ });
    expect(th.getAttribute("aria-sort")).toBe("descending");
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("does NOT render a sort button for a column without a sortKey (no onSort wiring either)", () => {
    render(
      <Table
        columns={[
          { key: "name", header: "Nombre" },
          { key: "date", header: "Fecha", sortKey: "date" },
        ]}
        rows={[]}
        onSort={() => {}}
      />,
    );
    const plain = screen.getByRole("columnheader", { name: "Nombre" });
    expect(plain.querySelector("button")).toBeNull();
    expect(plain.getAttribute("aria-sort")).toBeNull();
    expect(screen.getByRole("button", { name: /Fecha/ })).toBeInTheDocument();
  });
});

describe("SearchBar", () => {
  it("renders an input with placeholder and aria-label and forwards changes", () => {
    const onChange = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={onChange}
        placeholder="Buscar (mín. 3 caracteres)"
        label="Buscar"
      />,
    );
    const input = screen.getByRole("searchbox", { name: "Buscar" });
    expect(input).toHaveAttribute("placeholder", "Buscar (mín. 3 caracteres)");
    fireEvent.change(input, { target: { value: "ana" } });
    expect(onChange).toHaveBeenCalledWith("ana");
  });

  it("fires onSubmit when Enter is pressed", () => {
    const onSubmit = vi.fn();
    render(<SearchBar value="ana" onChange={() => {}} onSubmit={onSubmit} />);
    const input = screen.getByRole("searchbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("SearchableSelect", () => {
  const options = [
    { id: 1, full_name: "Ana Perez", cedula: "001-0000000-0", nss: "12345678901" },
    { id: 2, full_name: "Luis Perez", cedula: "002-0000000-0", nss: "98765432109" },
  ];

  function setup() {
    const onSelect = vi.fn();
    const search = vi.fn(async (q: string) =>
      options.filter((o) => o.full_name.toLowerCase().includes(q.toLowerCase())),
    );
    const utils = render(
      <SearchableSelect
        value={options[0]}
        onSelect={onSelect}
        search={search}
        placeholder="Buscar paciente"
        getLabel={(p) => p.full_name}
        getSublabel={(p) => `${p.cedula} · NSS ${p.nss}`}
      />,
    );
    return { ...utils, onSelect, search };
  }

  it("shows the selected value with label and sublabel as a trigger", () => {
    setup();
    expect(screen.getByText("Ana Perez")).toBeInTheDocument();
    expect(screen.getByText("001-0000000-0 · NSS 12345678901")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("opens an input on click, searches from the 4th character and selects an option", async () => {
    vi.useFakeTimers();
    try {
      const { onSelect, search } = setup();
      fireEvent.click(screen.getByRole("button"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "luis" } });
      await vi.advanceTimersByTimeAsync(300);
      expect(search).toHaveBeenCalledWith("luis");
      fireEvent.click(screen.getByRole("button", { name: /Luis Perez/ }));
      expect(onSelect).toHaveBeenCalledWith(options[1]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the min-chars hint before reaching the 4th character", async () => {
    vi.useFakeTimers();
    try {
      setup();
      fireEvent.click(screen.getByRole("button"));
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "an" } });
      await vi.advanceTimersByTimeAsync(300);
      expect(screen.getByText("Escribe al menos 3 caracteres")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
