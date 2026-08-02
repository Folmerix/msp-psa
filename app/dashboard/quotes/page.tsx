"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Quote = { id: string; quote_number: string; status: string; valid_until: string | null; total: number; title: string | null; clients: { name: string } | null };

const badge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("quotes").select("id, quote_number, status, valid_until, total, title, clients(name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setQuotes((data as unknown as Quote[]) ?? []); setLoading(false); });
  }, []);

  const total = quotes.filter(q => q.status === "accepted").reduce((s, q) => s + (q.total ?? 0), 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          {total > 0 && <p className="text-sm text-gray-500 mt-1">Accepted value: <span className="font-semibold text-green-600">${total.toFixed(2)}</span></p>}
        </div>
        <Link href="/dashboard/quotes/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm">
          + New Quote
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading…</div>
        ) : quotes.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No quotes yet.</p>
            <Link href="/dashboard/quotes/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline font-medium">Create your first quote →</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quote #</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Valid Until</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/quotes/${q.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">{q.quote_number}</Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{q.clients?.name ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">{q.title ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${badge[q.status] ?? "bg-gray-100 text-gray-600"}`}>{q.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{q.valid_until ? new Date(q.valid_until + "T12:00:00").toLocaleDateString() : <span className="text-gray-300">—</span>}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">${(q.total ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
