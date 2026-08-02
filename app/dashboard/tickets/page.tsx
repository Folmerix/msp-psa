"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Ticket = { id: string; title: string; status: string; priority: string; created_at: string; clients: { name: string } | null; profiles: { full_name: string } | null };

const statusBadge: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  waiting: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-500",
};

const priorityBadge: Record<string, string> = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const filterLabels: Record<string, string> = {
  all: "All",
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  closed: "Closed",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const query = supabase
      .from("tickets")
      .select("id, title, status, priority, created_at, clients(name), profiles!tickets_assigned_to_fkey(full_name)")
      .order("created_at", { ascending: false });
    (filter === "all" ? query : query.eq("status", filter))
      .then(({ data }) => { setTickets((data as unknown as Ticket[]) ?? []); setLoading(false); });
  }, [filter]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          {tickets.length > 0 && <p className="text-sm text-gray-500 mt-1">{tickets.filter(t => t.status === "open").length} open</p>}
        </div>
        <Link href="/dashboard/tickets/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm">
          + New Ticket
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5">
        {Object.entries(filterLabels).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === key ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">{filter === "all" ? "No tickets yet." : `No ${filterLabels[filter].toLowerCase()} tickets.`}</p>
            {filter === "all" && <Link href="/dashboard/tickets/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline font-medium">Create your first ticket →</Link>}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned To</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/tickets/${t.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">{t.title}</Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.clients?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${priorityBadge[t.priority] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.profiles?.full_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
