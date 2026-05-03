import { plaidClient } from "./plaid-client";
import { supaAdmin } from "./db";

export interface SyncResult {
  accounts: number;
  transactions: number;
}

export async function syncPlaidItem(
  accessToken: string,
  plaidItemId: string,
  userId: string,
  institutionName: string | null
): Promise<SyncResult> {
  // 1. Fetch accounts from Plaid
  const accountsResp = await plaidClient.accountsGet({ access_token: accessToken });
  const plaidAccounts = accountsResp.data.accounts;

  // Maps plaid account_id → local DB UUID
  const accountIdMap: Record<string, string> = {};

  for (const pa of plaidAccounts) {
    const { data: acc } = await supaAdmin
      .from("accounts")
      .upsert(
        {
          user_id: userId,
          plaid_item_id: plaidItemId,
          plaid_account_id: pa.account_id,
          name: pa.name,
          type: pa.type,
          subtype: pa.subtype ?? null,
          institution_name: institutionName,
        },
        { onConflict: "plaid_account_id" }
      )
      .select("id")
      .single();

    if (!acc) continue;
    accountIdMap[pa.account_id] = acc.id as string;

    // Insert a balance snapshot if current balance is available
    if (pa.balances.current != null) {
      await supaAdmin.from("balances").insert({
        account_id: acc.id,
        current: pa.balances.current,
        available: pa.balances.available ?? null,
        limit: pa.balances.limit ?? null,
        iso_currency_code: pa.balances.iso_currency_code ?? "USD",
        snapshot_date: new Date().toISOString().split("T")[0],
      });
    }
  }

  // 2. Fetch transactions for the last 90 days
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let offset = 0;
  let totalTransactions = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const txResp = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset },
    });

    const { transactions, total_transactions } = txResp.data;
    totalTransactions = total_transactions;

    if (transactions.length > 0) {
      const rows = transactions
        .map((tx) => {
          const accountId = accountIdMap[tx.account_id];
          if (!accountId) return null;
          return {
            account_id: accountId,
            plaid_transaction_id: tx.transaction_id,
            amount: tx.amount, // Plaid: positive = expense, negative = income
            currency: tx.iso_currency_code ?? "USD",
            merchant_name: tx.merchant_name ?? null,
            name: tx.name,
            category: tx.category ?? [],
            date: tx.date,
            authorized_date: tx.authorized_date ?? null,
            pending: tx.pending,
          };
        })
        .filter(Boolean);

      if (rows.length > 0) {
        await supaAdmin
          .from("transactions")
          .upsert(rows, { onConflict: "plaid_transaction_id", ignoreDuplicates: false });
      }
    }

    offset += transactions.length;
    if (offset >= total_transactions) break;
  }

  return { accounts: plaidAccounts.length, transactions: totalTransactions };
}
