import { api, downloadBlob } from "./api";
import type { Paginated, ReportDefinition, ReportPack } from "./types";

export function listDefinitions(): Promise<Paginated<ReportDefinition>> {
  return api.get<Paginated<ReportDefinition>>("/reportes/definiciones/?page_size=100");
}

export function listPacks(): Promise<Paginated<ReportPack>> {
  return api.get<Paginated<ReportPack>>("/reportes/paquetes/?page_size=100");
}

export function createDefinition(body: Partial<ReportDefinition>): Promise<ReportDefinition> {
  return api.post<ReportDefinition>("/reportes/definiciones/", body);
}

export function updateDefinition(id: number, body: Partial<ReportDefinition>): Promise<ReportDefinition> {
  return api.patch<ReportDefinition>(`/reportes/definiciones/${id}/`, body);
}

export function createPack(body: Partial<ReportPack>): Promise<ReportPack> {
  return api.post<ReportPack>("/reportes/paquetes/", body);
}

export function updatePack(id: number, body: Partial<ReportPack>): Promise<ReportPack> {
  return api.patch<ReportPack>(`/reportes/paquetes/${id}/`, body);
}

export interface GenerateReportParams {
  mes: string;
  ars?: number | null;
  programa?: number | null;
  centro?: number | null;
}

export interface GeneratePackParams {
  mes: string;
  centro?: number | null;
}

export function generateReport(id: number, params: GenerateReportParams) {
  return downloadBlob(`/reportes/definiciones/${id}/generar/`, params);
}

export function generatePack(id: number, params: GeneratePackParams) {
  return downloadBlob(`/reportes/paquetes/${id}/generar/`, params);
}

/** Triggers a browser save for a blob/filename pair returned by
 * generateReport/generatePack -- there is no server-side download
 * precedent to deviate from (client-side `<a download>` is the standard
 * way to save a blob response). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
