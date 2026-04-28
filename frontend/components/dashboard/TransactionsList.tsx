"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetcher, transactionsKey } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TransactionResponse } from "@/types/api";
import type { ApiResponse } from "@/types/api";

const PAGE_SIZE = 20;

interface TransactionsListProps {
  refreshKey?: number;
}

// The transactions endpoint returns paginated data; SWR returns the unwrapped
// list because apiFetcher unwraps { data }. We fetch the raw response here
// to access meta.total for pagination.

async function fetchTransactions(key: string): Promise<{
  items: TransactionResponse[];
  total: number;
}> {
  
  const token = getStoredToken();

  const res = await fetch(key, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body: ApiResponse<TransactionResponse[]> = await res.json();
  if (!res.ok || body.error) throw new Error(body.error ?? "Request failed");
  return { items: body.data ?? [], total: body.meta?.total ?? 0 };
}

export function TransactionsList({ refreshKey = 0 }: TransactionsListProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  // Simple debounce via separate state
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearch(val);
      setPage(0);
      clearTimeout((window as unknown as { _searchTimer: number })._searchTimer);
      (window as unknown as { _searchTimer: number })._searchTimer = window.setTimeout(
        () => setDebouncedSearch(val),
        300
      );
    },
    []
  );

  const swrKey = transactionsKey({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const { data, isLoading } = useSWR(
    [swrKey, refreshKey],
    ([key]) => fetchTransactions(key),
    { keepPreviousData: true }
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">
            Transactions
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({total})
              </span>
            )}
          </CardTitle>
          <Input
            placeholder="Search…"
            value={search}
            onChange={handleSearchChange}
            className="h-8 w-48 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {isLoading && items.length === 0 ? (
          <div className="space-y-2 p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground px-6 text-center">
            {debouncedSearch
              ? `No transactions matching "${debouncedSearch}"`
              : "No transactions yet. Import a CSV from your bank to get started."}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                    <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                      Category
                    </th>
                    <th className="px-4 py-2 text-left font-medium hidden lg:table-cell">
                      Account
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((txn) => {
                    const isDebit = txn.amount > 0;
                    const topCategory = txn.category?.[0];

                    return (
                      <tr
                        key={txn.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* Date */}
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground text-xs">
                          {formatDate(txn.date)}
                        </td>

                        {/* Description */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[160px] font-medium">
                              {txn.merchant_name ?? txn.name}
                            </span>
                            {txn.pending && (
                              <Badge variant="warning" className="text-[10px] py-0">
                                Pending
                              </Badge>
                            )}
                          </div>
                          {txn.merchant_name && txn.name !== txn.merchant_name && (
                            <p className="truncate text-xs text-muted-foreground max-w-[160px]">
                              {txn.name}
                            </p>
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          {topCategory ? (
                            <Badge variant="secondary" className="text-xs">
                              {topCategory}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Account */}
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell truncate max-w-[120px]">
                          {txn.account_name}
                        </td>

                        {/* Amount */}
                        <td
                          className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${
                            isDebit ? "text-foreground" : "text-emerald-600"
                          }`}
                        >
                          {isDebit ? "" : "+"}
                          {formatCurrency(Math.abs(txn.amount), txn.currency ?? "USD")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
