// Restoring Settings, Slice Q: a small, real API surface -- not the
// vendored settings/{translation,backup,e-invoice,team,webhook-leads}
// sub-features, none of which have a fit in this domain.
import { apiGet, apiPatch, apiPost } from '@/shared/lib/api';

export interface Profile {
  role: string;
  email: string;
  full_name: string;
  totp_enabled: boolean;
}

export function getProfile(): Promise<Profile> {
  return apiGet<Profile>('/v1/users/me/');
}

export interface TotpEnrollment {
  secret: string;
  provisioning_uri: string;
}

export function startTotpEnrollment(): Promise<TotpEnrollment> {
  return apiPost<TotpEnrollment>('/v1/users/me/totp/enroll', {});
}

export function confirmTotpEnrollment(code: string): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/v1/users/me/totp/confirm', { code });
}

export function disableTotp(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/v1/users/me/totp/disable', {});
}

export interface LlmSettingsStatus {
  deepseek_configured: boolean;
  openai_configured: boolean;
  anthropic_configured: boolean;
}

export function getLlmSettings(): Promise<LlmSettingsStatus> {
  return apiGet<LlmSettingsStatus>('/v1/settings/llm');
}

export function updateLlmSettings(patch: { deepseek_api_key?: string; openai_api_key?: string; anthropic_api_key?: string }): Promise<LlmSettingsStatus> {
  return apiPatch<LlmSettingsStatus>('/v1/settings/llm', patch);
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/v1/users/me/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
