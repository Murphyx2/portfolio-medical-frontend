import { api } from "./api";
import type { SystemSettings } from "./types";

export function getSettings(): Promise<SystemSettings> {
  return api.get<SystemSettings>("/settings/");
}

export function updateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  return api.patch<SystemSettings>("/settings/", patch);
}

export function resetSettings(): Promise<SystemSettings> {
  return api.post<SystemSettings>("/settings/reset/", {});
}

/** Doctors/nurses can't reach `/settings/` (ADMIN/IT-only), but they're the
 * ones who upload record images -- this narrower endpoint exposes just the
 * one field they need to pre-check a selected file client-side before
 * uploading it (apps/records/views.py::upload_limits). */
export function getUploadLimits(): Promise<{ max_image_upload_mb: number }> {
  return api.get<{ max_image_upload_mb: number }>("/records/upload-limits/");
}
