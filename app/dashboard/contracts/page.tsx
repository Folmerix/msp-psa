"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Contract = {
  id: string;
  name: string;
  amount: number;
  billing_day: number;
  status: string;
  last_billed_at: string | null;
  clients: { id: string; name: string } | null;
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<number | null>(null);

  async function load() {
    const { data } = await supabase
      .from("contracts")
      .select("id, name, amount, billing_day, status, last_billed_at, clients(id, name)")
      .order("created_at", { ascending: false });
    setContracts((data as unknown as Contract[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function generateMonthlyInvoices() {
    setGenerating(true);
    setGenerated(null);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    // Get active contracts not yet billed this month
    const { data: due } = await supabase
      .from("contracts")
      .select("id, name, amount, client_id, last_billed_at")
      .eq("status", "active")
      .or(`last_billed_at.is.null,last_billed_at.lt.${monthStart}`);

    if (!due || due.length === 0) {
      setGenerating(false);
      setGenerated(0);
      return;
    }

    // Group by client
    const byClient: Record<string, typeof due> = {};
    for (const c of due) {
      if (!byClient[c.client_id]) byClient[c.client_id] = [];
      byClient[c.client_id].push(c);
    }

    let invoiceCount = 0;

    for (const [clientId, clientContracts] of Object.entries(byClient)) {
      const total = clientContracts.reduce((sum, c) => sum + c.amount, 0);

      // Create invoice
      const { data: invoice } = await supabase
        .from("invoices")
        .insert({
          client_id: clientId,
          issue_date: now.toISOString().split("T")[0],
          total,
          notes: `Auto-generated for ${now.toLocaleString("default", { month: "long", year: "numeric" })}`,
        })
        .select()
        .single();

      if (!invoice) continue;

      // Create one line item per contract
      const lineItems = clientContracts.map((c) => ({
        invoice_id: invoice.id,
        description: c.name,
        quantity: 1,
        unit_price: c.amount,
      }));
      await supabase.from("invoice_items").insert(lineItems);

      // Mark contracts as billed
      await supabase
        .from("contracts")
        .update({ last_billed_at: now.toISOString().split("T")[0] })
        .in("id", clientContracts.map((c) => c.id));

      invoiceCount++;
    }

    setGenerated(invoiceCount);
    setGenerating(false);
    load();
  }

  const activeTotal = contracts
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Contracts</h1>
          {contracts.filter(c => c.status === "active").length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {contracts.filter(c => c.status === "active").length} active — ${activeTotal.toFixed(2)}/mo MRR
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generateMonthlyInvoices}
            disabled={generating}
            className="bg-gray-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Monthly Invoices"}
          </button>
          <Link
            href="/dashboard/contracts/new"
            className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            + New Contract
          </Link>
        </div>
      </div>

      {generated !== null && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${generated > 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-600 border"}`}>
          {generated > 0
            ? `✓ Generated ${generated} invoice${generated !== 1 ? "s" : ""} — view them in Invoices.`
            : "All active contracts have already been billed this month."}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading...</p>
        ) : contracts.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No contracts yet. Add one to start tracking monthly billing.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contract</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Bills on</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Billed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {c.clients ? (
                      <Link href={`/dashboard/clients/${c.clients.id}`} className="font-medium hover:underline">
                        {c.clients.name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.name}</td>
                  <td className="px-4 py-3 font-medium">${c.amount.toFixed(2)}/mo</td>
                  <td className="px-4 py-3 text-gray-500">Day {c.billing_day}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.last_billed_at ? new Date(c.last_billed_at + "T12:00:00").toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
