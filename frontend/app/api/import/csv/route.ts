export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

function detectColumns(headers: string[]) {
  const h = headers.map((s) => s.trim().toLowerCase());
  const find = (...candidates: string[]) => {
    for (const c of candidates) { const i = h.indexOf(c); if (i >= 0) return i; }
    return null;
  };
  return {
    date: find("date", "transaction date", "posted date", "trans. date"),
    name: find("description", "name", "memo", "transaction description", "details"),
    amount: find("amount", "transaction amount"),
    debit: find("debit", "withdrawal", "withdrawals", "charges"),
    credit: find("credit", "deposit", "deposits", "payments"),
  };
}

function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[$,]/g, "");
  if (s.startsWith("(") && s.endsWith(")")) s = "-" + s.slice(1, -1);
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseDate(raw: string): string | null {
  const fmts = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ];
  for (const fmt of fmts) {
    const m = raw.trim().match(fmt);
    if (m) {
      if (fmt.source.startsWith("^(\\d{4})")) return `${m[1]}-${m[2]}-${m[3]}`;
      return `${m[3]}-${m[1]}-${m[2]}`;
    }
  }
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const account_id = sp.get("account_id");
  const flipSign = sp.get("flip_sign") === "true";
  if (!account_id)
    return Response.json({ data: null, error: "account_id required" }, { status: 400 });

  const [{ data: acct }, { data: rules }] = await Promise.all([
    supaAdmin.from("accounts").select("id").eq("id", account_id).eq("user_id", user.sub).maybeSingle(),
    supaAdmin.from("categorization_rules").select("pattern, category").eq("user_id", user.sub),
  ]);
  if (!acct)
    return Response.json({ data: null, error: "Account not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ data: null, error: "No file uploaded" }, { status: 400 });

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2)
    return Response.json({ data: null, error: "CSV appears empty" }, { status: 422 });

  const parseRow = (line: string) =>
    [...line.matchAll(/("(?:[^"]|"")*"|[^,]*)/g)]
      .filter((_, i) => i % 2 === 0)
      .map((m) => m[1].replace(/^"|"$/g, "").replace(/""/g, '"'));

  const headers = parseRow(lines[0]);
  const cols = detectColumns(headers);

  if (cols.date === null || cols.name === null)
    return Response.json({ data: null, error: "Could not detect Date/Description columns" }, { status: 422 });

  const rows: { account_id: string; name: string; amount: number; date: string; currency: string; pending: boolean }[] = [];
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const row = parseRow(line);
    const txnDate = parseDate(row[cols.date] ?? "");
    const name = row[cols.name ?? 0]?.trim();
    if (!txnDate || !name) { skipped++; continue; }

    let amount: number | null = null;
    if (cols.amount != null) {
      amount = parseAmount(row[cols.amount] ?? "");
    } else if (cols.debit != null && cols.credit != null) {
      const d = row[cols.debit]?.trim();
      const c = row[cols.credit]?.trim();
      if (d) amount = Math.abs(parseAmount(d) ?? 0);
      else if (c) amount = -(Math.abs(parseAmount(c) ?? 0));
    }
    if (amount === null) { skipped++; continue; }

    const haystack = name.toLowerCase();
    const ruleMatch = (rules ?? [] as { pattern: string; category: string }[]).find((r: { pattern: string; category: string }) => haystack.includes(r.pattern));
    const category = ruleMatch ? [ruleMatch.category] : null;
    rows.push({ account_id, name, amount: flipSign ? -amount : amount, date: txnDate, currency: "USD", pending: false, ...(category ? { category } : {}) });
  }

  if (rows.length > 0) {
    await supaAdmin.from("transactions").insert(rows);
  }

  return Response.json({ data: { imported: rows.length, skipped, account_id }, error: null });
}