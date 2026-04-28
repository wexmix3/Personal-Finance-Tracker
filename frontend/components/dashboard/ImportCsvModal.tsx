"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { importCsv } from "@/lib/api";
import type { AccountResponse } from "@/types/api";

interface Props {
  accounts: AccountResponse[];
  onSuccess?: () => void;
}

export function ImportCsvModal({ accounts, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [flipSign, setFlipSign] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setFlipSign(false);
    setAccountId(accounts[0]?.id ?? "");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImport() {
    if (!file || !accountId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importCsv(accountId, file, flipSign);
      setResult(res);
      onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setAccountId(accounts[0]?.id ?? ""); }}>
        Import CSV
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-background shadow-xl border">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Import Transactions from CSV</h2>
              <button
                onClick={() => { setOpen(false); reset(); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* How to get your CSV */}
              <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1">
                <p className="font-medium">How to download your transactions:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li><strong>Chase:</strong> Accounts → Download Account Activity → CSV</li>
                  <li><strong>Bank of America:</strong> Accounts → Download → CSV Format</li>
                  <li><strong>Wells Fargo:</strong> Accounts → Download Transactions → CSV</li>
                  <li><strong>Capital One:</strong> Accounts → Download Transactions</li>
                  <li><strong>Citi:</strong> Accounts → Download → CSV</li>
                  <li><strong>Fidelity / Vanguard:</strong> Activity & Orders → Download</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Import into Account *</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.institution_name ? ` (${a.institution_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">CSV File *</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm cursor-pointer"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flipSign}
                  onChange={e => setFlipSign(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span className="text-sm">
                  <span className="font-medium">Flip amount signs</span>
                  <span className="text-muted-foreground"> — check this for Chase, Citi, and most credit cards (they export purchases as negative numbers)</span>
                </span>
              </label>

              {result && (
                <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm">
                  <p className="font-medium text-green-800 dark:text-green-200">Import complete!</p>
                  <p className="text-green-700 dark:text-green-300">
                    {result.imported} transaction{result.imported !== 1 ? "s" : ""} imported
                    {result.skipped > 0 ? `, ${result.skipped} rows skipped` : ""}.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setOpen(false); reset(); }}
                >
                  Close
                </Button>
                <Button
                  className="flex-1"
                  disabled={!file || !accountId || loading}
                  onClick={handleImport}
                >
                  {loading ? "Importing…" : "Import"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
