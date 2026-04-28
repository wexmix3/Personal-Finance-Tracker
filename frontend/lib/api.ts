/**
 * Typed API client + SWR fetcher.
 */
import { getStoredToken } from "@/lib/auth";
import type {
  AccountResponse,
  ApiResponse,
  CreateAccountRequest,
  NetWorthHistoryResponse,
  NetWorthResponse,
  TransactionResponse,
} from "@/types/api";

const API_URL = "";

// -----------------------------------------------------------------------
// Base fetch
// -----------------------------------------------------------------------
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body: ApiResponse<T> = await res.json();

  if (!res.ok) {
    throw new Error(
      (body as unknown as { detail?: string }).detail ??
        body.error ??
        `Request failed: ${res.status}`
    );
  }
  if (body.error) throw new Error(body.error);
  return body.data as T;
}

export async function apiFetcher<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export async function apiPost<TBody, TResponse>(
  path: string,
  body: TBody
): Promise<TResponse> {
  return apiFetch<TResponse>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPatch<TBody, TResponse>(
  path: string,
  body: TBody
): Promise<TResponse> {
  return apiFetch<TResponse>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiDelete<TResponse>(path: string): Promise<TResponse> {
  return apiFetch<TResponse>(path, { method: "DELETE" });
}

// -----------------------------------------------------------------------
// SWR cache keys
// -----------------------------------------------------------------------
export function accountsKey() {
  return "/api/accounts";
}

export function transactionsKey(params?: {
  limit?: number;
  offset?: number;
  account_id?: string;
  search?: string;
  pending?: boolean;
  category?: string;
}) {
  if (!params) return "/api/transactions";
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.account_id) q.set("account_id", params.account_id);
  if (params.search) q.set("search", params.search);
  if (params.pending != null) q.set("pending", String(params.pending));
  if (params.category) q.set("category", params.category);
  const qs = q.toString();
  return `/api/transactions${qs ? `?${qs}` : ""}`;
}

export function netWorthKey() {
  return "/api/net-worth";
}

export function netWorthHistoryKey(days = 90) {
  return `/api/net-worth/history?days=${days}`;
}

// -----------------------------------------------------------------------
// Account mutations
// -----------------------------------------------------------------------
export async function createAccount(data: CreateAccountRequest): Promise<{ id: string }> {
  return apiPost("/api/accounts", data);
}

export async function updateAccountBalance(
  accountId: string,
  current_balance: number
): Promise<void> {
  await apiPatch(`/api/accounts/${accountId}`, { current_balance });
}

export async function deleteAccount(accountId: string): Promise<void> {
  await apiDelete(`/api/accounts/${accountId}`);
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  await apiDelete(`/api/transactions/${transactionId}`);
}

// -----------------------------------------------------------------------
// CSV import
// -----------------------------------------------------------------------
export async function importCsv(
  accountId: string,
  file: File,
  flipSign = false
): Promise<{ imported: number; skipped: number }> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append("file", file);

  const qs = new URLSearchParams({ account_id: accountId });
  if (flipSign) qs.set("flip_sign", "true");

  const res = await fetch(`/api/import/csv?${qs}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail ?? body.error ?? `Import failed: ${res.status}`);
  return body.data;
}

// Re-export types for convenience
export type {
  AccountResponse,
  NetWorthResponse,
  NetWorthHistoryResponse,
  TransactionResponse,
};
