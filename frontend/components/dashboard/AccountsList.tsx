"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetcher, accountsKey } from "@/lib/api";
import { formatCurrency, capitalize } from "@/lib/utils";
import type { AccountResponse } from "@/types/api";

interface AccountsListProps {
  refreshKey?: number;
  onRefresh?: () => void;
}

const TYPE_COLORS: Record<string, "default" | "secondary" | "success" | "warning"> = {
  depository: "success",
  investment: "default",
  credit: "warning",
  loan: "secondary",
};

export function AccountsList({ refreshKey = 0, onRefresh: _onRefresh }: AccountsListProps) {
  const { data: accounts, isLoading } = useSWR<AccountResponse[]>(
    [accountsKey(), refreshKey],
    ([key]) => apiFetcher<AccountResponse[]>(key),
    { refreshInterval: 60_000 }
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Accounts</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground px-6 text-center">
            No accounts yet. Add an account to get started.
          </div>
        ) : (
          <ul className="divide-y">
            {accounts.map((acct) => {
              const balance = acct.latest_balance?.current;
              const isLiability = acct.type === "credit" || acct.type === "loan";

              return (
                <li key={acct.id} className="flex items-center gap-3 px-6 py-3">
                  {/* Institution + name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{acct.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {acct.institution_name ?? "Unknown institution"}
                      {acct.subtype ? ` · ${acct.subtype}` : ""}
                    </p>
                  </div>

                  {/* Type badge */}
                  <Badge
                    variant={TYPE_COLORS[acct.type] ?? "secondary"}
                    className="shrink-0 capitalize"
                  >
                    {capitalize(acct.type)}
                  </Badge>

                  {/* Balance */}
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        isLiability ? "text-rose-600" : "text-foreground"
                      }`}
                    >
                      {balance == null
                        ? "—"
                        : (isLiability ? "−" : "") + formatCurrency(balance).slice(1)}
                    </p>
                    {acct.latest_balance?.snapshot_date && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(
                          acct.latest_balance.snapshot_date + "T00:00:00"
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
