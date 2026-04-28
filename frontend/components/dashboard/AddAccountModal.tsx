"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createAccount } from "@/lib/api";

interface Props {
  onSuccess?: () => void;
  variant?: "default" | "outline" | "secondary";
  label?: string;
}

const ACCOUNT_TYPES = [
  { value: "depository", label: "Bank Account" },
  { value: "credit", label: "Credit Card" },
  { value: "investment", label: "Investment / Brokerage" },
  { value: "loan", label: "Loan / Mortgage" },
  { value: "other", label: "Other" },
] as const;

const SUBTYPES: Record<string, { value: string; label: string }[]> = {
  depository: [
    { value: "checking", label: "Checking" },
    { value: "savings", label: "Savings" },
    { value: "money market", label: "Money Market" },
    { value: "cd", label: "CD" },
    { value: "other", label: "Other" },
  ],
  credit: [
    { value: "credit card", label: "Credit Card" },
    { value: "other", label: "Other" },
  ],
  investment: [
    { value: "brokerage", label: "Brokerage" },
    { value: "401k", label: "401(k)" },
    { value: "ira", label: "IRA" },
    { value: "roth", label: "Roth IRA" },
    { value: "other", label: "Other" },
  ],
  loan: [
    { value: "mortgage", label: "Mortgage" },
    { value: "student", label: "Student Loan" },
    { value: "auto", label: "Auto Loan" },
    { value: "personal", label: "Personal Loan" },
    { value: "other", label: "Other" },
  ],
  other: [{ value: "other", label: "Other" }],
};

export function AddAccountModal({ onSuccess, variant = "default", label = "Add Account" }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState("depository");
  const [subtype, setSubtype] = useState("checking");
  const [balance, setBalance] = useState("");

  function resetForm() {
    setName("");
    setInstitution("");
    setType("depository");
    setSubtype("checking");
    setBalance("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bal = parseFloat(balance);
    if (isNaN(bal)) {
      setError("Enter a valid balance amount.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createAccount({
        name: name.trim(),
        institution_name: institution.trim() || undefined,
        type,
        subtype: subtype || undefined,
        current_balance: bal,
      });
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background shadow-xl border">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Add Account</h2>
              <button
                onClick={() => { setOpen(false); resetForm(); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Account Name *</label>
                <input
                  required
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Chase Checking"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Institution (optional)</label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Chase, Fidelity, Vanguard"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Account Type *</label>
                  <select
                    required
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      setSubtype(SUBTYPES[e.target.value]?.[0]?.value ?? "");
                    }}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Subtype</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={subtype}
                    onChange={(e) => setSubtype(e.target.value)}
                  >
                    {(SUBTYPES[type] ?? []).map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Current Balance *{" "}
                  <span className="text-muted-foreground font-normal">
                    {type === "credit" || type === "loan"
                      ? "(enter what you owe as a positive number)"
                      : "(current balance)"}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full rounded-md border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setOpen(false); resetForm(); }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Adding…" : "Add Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
