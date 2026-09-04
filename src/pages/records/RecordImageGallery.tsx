import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog, Dialog } from "../../components/ui";
import { api, ApiError, upload } from "../../services/api";
import type { MedicalRecord, RecordImage } from "../../services/types";
import { formatDateTime } from "../../utils/date";

interface QueuedImage {
  id: string;
  file: File;
  caption: string;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function makeQueueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** PDF-file tile icon -- same inline-SVG stroke weight/style as
 * `MaskedValue`'s lock icon (ui.tsx), not an emoji or a third-party icon
 * library, since the Archivos gallery now accepts PDFs alongside images
 * (RECETAS_REQUIREMENTS.md §9) and needs a way to represent one without an
 * `<img>` thumbnail. A simple page-with-folded-corner shape. */
function PdfFileIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21V3a.5.5 0 0 1 .5-.5Z" />
      <path d="M14 2.5V6a1 1 0 0 0 1 1h3.5" />
      <path d="M8.5 13h1.6a1.2 1.2 0 1 1 0 2.4H8.5V13Zm0 0v4.5" />
      <path d="M13 17.5V13h2a1.5 1.5 0 0 1 0 3h-2" />
      <path d="M17 17.5V13h2M17 15.2h1.6" />
    </svg>
  );
}

export function RecordImageGallery({
  images,
  recordId,
  maxUploadMb,
  canEdit,
  onChanged,
}: {
  images: RecordImage[];
  recordId: number;
  maxUploadMb?: number;
  canEdit: boolean;
  onChanged: (fresh: MedicalRecord) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedImage[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeError, setRemoveError] = useState("");

  function openPicker() {
    inputRef.current?.click();
  }

  // The "+" add-tile is a <div role="button">, not a native <button> (it
  // needs to sit inside the CSS grid alongside the image thumbnails) --
  // unlike a real button, it doesn't get Enter/Space activation for free.
  function onAddTileKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const next: QueuedImage[] = files.map((file) => ({
      id: makeQueueId(),
      file,
      caption: "",
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...next]);
    setSheetOpen(true);
  }

  function updateQueueCaption(id: string, caption: string) {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, caption } : q)));
  }

  function dropQueued(id: string) {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((q) => q.id !== id);
    });
  }

  function closeSheet() {
    queue.forEach((q) => URL.revokeObjectURL(q.previewUrl));
    setQueue([]);
    setSheetOpen(false);
    setBatchError("");
  }

  async function submitQueue() {
    setSubmitting(true);
    setBatchError("");
    let anyUploaded = false;
    for (const item of queue) {
      if (item.status === "done") continue;
      if (maxUploadMb && item.file.size > maxUploadMb * 1024 * 1024) {
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: t("records.imageTooLarge", { max: maxUploadMb }) } : q)));
        continue;
      }
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "uploading" } : q)));
      try {
        const fd = new FormData();
        fd.append("record", String(recordId));
        fd.append("image", item.file);
        fd.append("caption", item.caption);
        await upload("/images/", fd);
        anyUploaded = true;
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "done" } : q)));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : String(err);
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: message } : q)));
      }
    }
    // A failure here (expired session, network hiccup) must not fail
    // silently: the upload(s) already succeeded server-side, so leaving this
    // unhandled would strand the user with a "saved" toast and a gallery
    // that never reflects it, with zero visible error.
    let refetchFailed = false;
    if (anyUploaded) {
      try {
        const fresh = await api.get<MedicalRecord>(`/medical-records/${recordId}/`);
        onChanged(fresh);
      } catch (err) {
        refetchFailed = true;
        setBatchError(err instanceof ApiError ? err.message : String(err));
      }
    }
    setSubmitting(false);
    setQueue((prev) => {
      const hasErrors = prev.some((q) => q.status === "error");
      if (!hasErrors && !refetchFailed) {
        prev.forEach((q) => URL.revokeObjectURL(q.previewUrl));
        setSheetOpen(false);
        return [];
      }
      return prev;
    });
  }

  async function confirmRemove() {
    if (removingId == null) return;
    setRemoveError("");
    try {
      await api.delete(`/images/${removingId}/`);
      const fresh = await api.get<MedicalRecord>(`/medical-records/${recordId}/`);
      onChanged(fresh);
      setRemovingId(null);
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : String(err));
    }
  }

  return (
    <>
      <div className="dc-section-row">
        <h4>{t("records.archivos")}</h4>
        {canEdit && (
          <button type="button" className="dc-ghost-btn" onClick={openPicker}>
            {t("records.uploadImage")}
          </button>
        )}
      </div>
      <div className="dc-card">
        {images.length === 0 ? (
          <div className="dc-empty-gallery">
            {canEdit && (
              <div
                className="dc-add-tile"
                onClick={openPicker}
                onKeyDown={onAddTileKeyDown}
                role="button"
                tabIndex={0}
                aria-label={t("records.uploadImage")}
              >
                +
              </div>
            )}
            <p>{t("records.noImages")}</p>
          </div>
        ) : (
          <div className="dc-gallery">
            {images.map((img) => (
              <div className="dc-thumb" key={img.id}>
                {img.kind === "pdf" ? (
                  <div className="dc-thumb-pdf">
                    <PdfFileIcon />
                  </div>
                ) : (
                  <img src={img.image_url ?? ""} alt={img.caption} loading="lazy" />
                )}
                <div className="dc-thumb-actions">
                  <button type="button" onClick={() => window.open(img.image_url ?? "#", "_blank", "noreferrer")}>
                    {t("records.viewImage")}
                  </button>
                  {canEdit && (
                    <button type="button" onClick={() => setRemovingId(img.id)}>
                      {t("records.removeImage")}
                    </button>
                  )}
                </div>
                <div className="dc-cap">{img.caption || "—"}</div>
                <div className="dc-when">{formatDateTime(img.created_at)}</div>
              </div>
            ))}
            {canEdit && (
              <div
                className="dc-add-tile"
                onClick={openPicker}
                onKeyDown={onAddTileKeyDown}
                role="button"
                tabIndex={0}
                aria-label={t("records.uploadImage")}
              >
                +
              </div>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={onFilesSelected}
      />

      {sheetOpen && (
        <Dialog title={t("records.uploadAction")} onClose={closeSheet} preventClose={submitting}>
          {queue.map((item) => (
            <div className="dc-upload-row" key={item.id}>
              {item.file.type === "application/pdf" ? (
                <div className="dc-thumb-pdf dc-upload-row-pdf">
                  <PdfFileIcon />
                </div>
              ) : (
                <img src={item.previewUrl} alt="" />
              )}
              <input
                type="text"
                placeholder={t("records.imageTitle")}
                value={item.caption}
                onChange={(e) => updateQueueCaption(item.id, e.target.value)}
                disabled={item.status === "uploading" || item.status === "done"}
              />
              {item.status === "done" && <span className="dc-upload-status">✓</span>}
              {item.status === "error" && <span className="dc-upload-status error">{item.error}</span>}
              {item.status === "pending" && (
                <button type="button" className="btn ghost small" onClick={() => dropQueued(item.id)}>
                  ×
                </button>
              )}
            </div>
          ))}
          {batchError && <p className="form-error" role="alert">{batchError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={closeSheet} disabled={submitting}>
              {t("common.cancel")}
            </button>
            <button type="button" className="btn primary" onClick={submitQueue} disabled={submitting || queue.length === 0}>
              {submitting ? t("common.saving") : t("records.uploadAction")}
            </button>
          </div>
        </Dialog>
      )}

      {removingId != null && (
        <ConfirmDialog
          title={t("records.removeImage")}
          message={t("records.confirmRemoveImage")}
          confirmLabel={t("records.removeImage")}
          danger
          error={removeError}
          onConfirm={confirmRemove}
          onCancel={() => {
            setRemovingId(null);
            setRemoveError("");
          }}
        />
      )}
    </>
  );
}
