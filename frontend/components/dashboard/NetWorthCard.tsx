"use client";

import useSWR from "swr";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetcher, netWorthKey, netWorthHistoryKey } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { NetWorthHistoryResponse, NetWorthResponse } from "@/types/api";

interface NetWorthCardProps {
  /** Bump this to force a data refresh (e.g. after linking a bank). */
  refreshKey?: number;
}

export function NetWorthCard({ refreshKey = 0 }: NetWorthCardProps) {
  const { data: nw, isLoading: nwLoading } = useSWR<NetWorthResponse>(
    [netWorthKey(), refreshKey],
    ([key]) => apiFetcher<NetWorthResponse>(key),
    { refreshInterval: 60_000 }
  );

  const { data: history, isLoading: histLoading } =
    useSWR<NetWorthHistoryResponse>(
      [netWorthHistoryKey(90), refreshKey],
      ([key]) => apiFetcher<NetWorthHistoryResponse>(key),
      { refreshInterval: 60_000 }
    );

  const isLoading = nwLoading || histLoading;

  // Only show days that have non-zero net worth (sparse data in early days)
  const chartData =
    history?.history
      .filter((p) => p.total_assets !== 0 || p.total_liabilities !== 0)
      .map((p) => ({
        date: p.snapshot_date,
        "Net Worth": Number(p.net_worth),
        Assets: Number(p.total_assets),
        Liabilities: Number(p.total_liabilities),
      })) ?? [];

  const netWorthValue = nw?.net_worth ?? 0;
  const isPositive = netWorthValue >= 0;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardDescription>Net Worth</CardDescription>
            {isLoading ? (
              <div className="h-9 w-48 animate-pulse rounded bg-muted mt-1" />
            ) : (
              <CardTitle
                className={`text-3xl ${
                  isPositive ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatCurrency(netWorthValue)}
              </CardTitle>
            )}
          </div>
          {!isLoading && nw && (
            <div className="text-right text-sm text-muted-foreground space-y-1">
              <div>
                <span className="text-emerald-600 font-medium">
                  {formatCurrency(nw.total_assets)}
                </span>{" "}
                assets
              </div>
              <div>
                <span className="text-rose-500 font-medium">
                  {formatCurrency(nw.total_liabilities)}
                </span>{" "}
                liabilities
              </div>
              <div className="text-xs">as of {formatDate(nw.as_of)}</div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="h-40 w-full animate-pulse rounded bg-muted" />
        ) : chartData.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No history yet — connect a bank account to see your net worth trend.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? "#10b981" : "#f43f5e"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? "#10b981" : "#f43f5e"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) =>
                  new Date(v + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
                width={52}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), ""]}
                labelFormatter={(label: string) => formatDate(label)}
              />
              <Area
                type="monotone"
                dataKey="Net Worth"
                stroke={isPositive ? "#10b981" : "#f43f5e"}
                strokeWidth={2}
                fill="url(#nwGradient)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
