"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Invoice = { id: string; invoice_number: string; status: string; due_date: string | null; total: number; title: string | null; clients: { name: string } | null };

const badge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("invoices").select("id, invoice_number, status, due_date, total, title, clients(name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setInvoices((data as unknown as Invoice[]) ?? []); setLoading(false); });
  }, []);

  const outstanding = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + (i.total ?? 0), 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          {outstanding > 0 && <p className="text-sm text-gray-500 mt-1">Outstanding: <span className="font-semibold text-red-600">${outstanding.toFixed(2)}</span></p>}
        </div>
        <Link href="/dashboard/invoices/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm">
          + New Invoice
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No invoices yet.</p>
            <Link href="/dashboard/invoices/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline font-medium">Create your first invoice →</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">{inv.invoice_number}</Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{inv.clients?.name ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">{inv.title ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${badge[inv.status] ?? "bg-gray-100 text-gray-600"}`}>{inv.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inv.due_date ? new Date(inv.due_date + "T12:00:00").toLocaleDateString() : <span className="text-gray-300">—</span>}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">${(inv.total ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
