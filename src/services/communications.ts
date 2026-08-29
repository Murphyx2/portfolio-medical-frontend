import { api } from "./api";
import type {
  CommunicationsDelivery,
  CommunicationsMessage,
  CommunicationsMessageCreate,
  CommunicationsSettings,
  CommunicationsTemplate,
  Paginated,
} from "./types";

export function listMessages(qs: string): Promise<Paginated<CommunicationsMessage>> {
  return api.get<Paginated<CommunicationsMessage>>(`/communications/messages/?${qs}`);
}

export function getMessage(id: number): Promise<CommunicationsMessage> {
  return api.get<CommunicationsMessage>(`/communications/messages/${id}/`);
}

export function createMessage(body: CommunicationsMessageCreate): Promise<CommunicationsMessage> {
  return api.post<CommunicationsMessage>("/communications/messages/", body);
}

export function sendTestEmail(messageId: number): Promise<{ detail: string }> {
  return api.post<{ detail: string }>(`/communications/messages/${messageId}/test/`, {});
}

export function listDeliveries(qs: string): Promise<Paginated<CommunicationsDelivery>> {
  return api.get<Paginated<CommunicationsDelivery>>(`/communications/deliveries/?${qs}`);
}

export function listTemplates(): Promise<Paginated<CommunicationsTemplate>> {
  return api.get<Paginated<CommunicationsTemplate>>("/communications/templates/?page_size=100");
}

export function createTemplate(
  body: Partial<CommunicationsTemplate>,
): Promise<CommunicationsTemplate> {
  return api.post<CommunicationsTemplate>("/communications/templates/", body);
}

export function updateTemplate(
  id: number,
  body: Partial<CommunicationsTemplate>,
): Promise<CommunicationsTemplate> {
  return api.patch<CommunicationsTemplate>(`/communications/templates/${id}/`, body);
}

export function deleteTemplate(id: number): Promise<void> {
  return api.delete<void>(`/communications/templates/${id}/`);
}

export function getCommunicationsSettings(): Promise<CommunicationsSettings> {
  return api.get<CommunicationsSettings>("/communications/settings/");
}

export function updateCommunicationsSettings(
  patch: Partial<CommunicationsSettings>,
): Promise<CommunicationsSettings> {
  return api.patch<CommunicationsSettings>("/communications/settings/", patch);
}

export function sendTestEmailGlobal(): Promise<{ detail: string }> {
  return api.post<{ detail: string }>("/communications/settings/test-email/", {});
}

export function sendTestWhatsapp(phone: string, kind?: string): Promise<{ detail: string }> {
  return api.post<{ detail: string }>("/communications/settings/test-whatsapp/", { phone, kind });
}
