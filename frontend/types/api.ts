// -----------------------------------------------------------------------
// Shared envelope — every backend response is wrapped in this shape
// -----------------------------------------------------------------------
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta: {
    total?: number;
    limit?: number;
    offset?: number;
  } | null;
}

// -----------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------
export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface UserResponse {
  id: string;
  email: string;
  created_at: string;
}

// -----------------------------------------------------------------------
// Accounts
// -----------------------------------------------------------------------
export interface BalanceSnapshot {
  current: number | null;
  available: number | null;
  limit: number | null;
  iso_currency_code: string | null;
  snapshot_date: string; // ISO date "2026-04-13"
  updated_at?: string | null;
}

export interface AccountResponse {
  id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  institution_name: string | null;
  latest_balance: BalanceSnapshot | null;
}

export interface CreateAccountRequest {
  name: string;
  institution_name?: string;
  type: string;
  subtype?: string;
  current_balance: number;
  currency?: string;
}

// -----------------------------------------------------------------------
// Transactions
// -----------------------------------------------------------------------
export interface TransactionResponse {
  id: string;
  account_id: string;
  account_name: string;
  amount: number;
  currency: string | null;
  merchant_name: string | null;
  name: string;
  category: string[] | null;
  date: string; // ISO date
  authorized_date: string | null;
  pending: boolean;
}

// -----------------------------------------------------------------------
// Net worth
// -----------------------------------------------------------------------
export interface NetWorthResponse {
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  as_of: string;
}

export interface NetWorthHistoryPoint {
  snapshot_date: string;
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
}

export interface NetWorthHistoryResponse {
  history: NetWorthHistoryPoint[];
  days: number;
}
