"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { importCsv } from "@/lib/api";
import type { AccountResponse } from "@/types/api";

interface Props {
  accounts: AccountResponse[];
  onSuccess?: () => void;
}

interface Preview {
  headers: string[];
  rows: string[][];
  detectedDate: string | null;
  detectedName: string | null;
  detectedAmount: string | null;
  rowCount: number;
}

function detectColumns(headers: string[]): { date: number | null; name: number | null; amount: number | null } {
  const h = headers.map(x => x.trim().toLowerCase());
  const find = (...candidates: string[]) => {
    for (const c of candidates) { const i = h.indexOf(c); if (i !== -1) return i; }
    return null;
  };
  return {
    date: find("date", "transaction date", "posted date", "trans. date"),
    name: find("description", "name", "memo", "transaction description", "details"),
    amount: find("amount", "transaction amount", "debit", "credit"),
  };
}

function parsePreview(text: string): Preview | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;

  // Simple CSV split respecting quoted fields
  function splitRow(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { result.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitRow(lines[0]);
  const dataRows = lines.slice(1, 6).map(splitRow); // preview first 5 data rows
  const cols = detectColumns(headers);

  return {
    headers,
    rows: dataRows,
    detectedDate: cols.date !== null ? headers[cols.date] : null,
    detectedName: cols.name !== null ? headers[cols.name] : null,
    detectedAmount: cols.amount !== null ? headers[cols.amount] : null,
    rowCount: lines.length - 1,
  };
}

export function ImportCsvModal({ accounts, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [flipSign, setFlipSign] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setPreviewError(null);
    setResult(null);
    setError(null);
    setFlipSign(false);
    setAccountId(accounts[0]?.id ?? "");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setPreviewError(null);
    setResult(null);
    setError(null);
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const p = parsePreview(text);
      if (!p) {
        setPreviewError("Couldn't read this file — make sure it's a valid CSV.");
      } else if (!p.detectedDate || !p.detectedName) {
        setPreviewError(
          `Could not detect required columns (Date, Description). Found: ${p.headers.join(", ")}. ` +
          "Please download a standard transaction CSV from your bank."
        );
      } else {
        setPreview(p);
      }
    };
    reader.readAsText(f);
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

  const missingColumns = preview && (!preview.detectedDate || !preview.detectedName || !preview.detectedAmount);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setAccountId(accounts[0]?.id ?? ""); }}>
        Import CSV
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background shadow-xl border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-background z-10">
              <h2 className="text-lg font-semibold">Import Transactions from CSV</h2>
              <button
                onClick={() => { setOpen(false); reset(); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Bank instructions */}
              <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-1">
                <p className="font-medium">How to download your transactions:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li><strong>Chase:</strong> Accounts → Download Account Activity → CSV</li>
                  <li><strong>Bank of America:</strong> Accounts → Download → CSV Format</li>
                  <li><strong>Wells Fargo:</strong> Accounts → Download Transactions → CSV</li>
                  <li><strong>Capital One / Citi:</strong> Accounts → Download Transactions</li>
                  <li><strong>Fidelity / Vanguard:</strong> Activity & Orders → Download</li>
                </ul>
              </div>

              {/* Account selector */}
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

              {/* File picker */}
              <div>
                <label className="block text-sm font-medium mb-1">CSV File *</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm cursor-pointer"
                  onChange={handleFileChange}
                />
              </div>

              {/* Preview error */}
              {previewError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {previewError}
                </div>
              )}

              {/* Preview table */}
              {preview && (
                <div className="space-y-3">
                  {/* Column detection summary */}
                  <div className="rounded-md border px-4 py-3 text-sm space-y-1.5">
                    <p className="font-medium text-sm">Detected columns</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <ColStatus label="Date" value={preview.detectedDate} />
                      <ColStatus label="Description" value={preview.detectedName} />
                      <ColStatus label="Amount" value={preview.detectedAmount} />
                    </div>
                    {missingColumns && (
                      <p className="text-amber-600 text-xs mt-1">
                        ⚠ Some columns couldn't be detected. The import may skip rows — try the flip sign option or verify your CSV format.
                      </p>
                    )}
                  </div>

                  {/* Row count */}
                  <p className="text-sm text-muted-foreground">
                    <strong>{preview.rowCount}</strong> data rows found — previewing first {Math.min(preview.rows.length, 5)}:
                  </p>

                  {/* Preview table */}
                  <div className="rounded-md border overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          {preview.headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.rows.map((row, ri) => (
                          <tr key={ri} className="hover:bg-muted/20">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 whitespace-nowrap max-w-[180px] truncate">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Flip sign */}
              {(preview || file) && (
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
              )}

              {/* Import result */}
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
                  {result ? "Done" : "Cancel"}
                </Button>
                {!result && (
                  <Button
                    className="flex-1"
                    disabled={!file || !accountId || loading || !!previewError}
                    onClick={handleImport}
                  >
                    {loading
                      ? "Importing…"
                      : preview
                        ? `Import ${preview.rowCount} rows`
                        : "Import"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ColStatus({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={`flex items-center gap-1.5 rounded px-2 py-1 ${value ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
      <span>{value ? "✓" : "?"}</span>
      <span className="font-medium">{label}:</span>
      <span className="truncate">{value ?? "not found"}</span>
    </div>
  );
}
