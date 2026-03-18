"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  clients: { name: string } | null;
  profiles: { full_name: string } | null;
};

const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  waiting: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-600",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const query = supabase
        .from("tickets")
        .select("id, title, status, priority, created_at, clients(name), profiles!tickets_assigned_to_fkey(full_name)")
        .order("created_at", { ascending: false });

      const { data } = filter === "all"
        ? await query
        : await query.eq("status", filter);

      setTickets((data as Ticket[]) ?? []);
      setLoading(false);
    }
    load();
  }, [filter]);

  const filters = ["all", "open", "in_progress", "waiting", "closed"];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Tickets</h1>
        <Link
          href="/dashboard/tickets/new"
          className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          + New Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm capitalize transition-colors ${
              filter === f
                ? "bg-black text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading...</p>
        ) : tickets.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No tickets found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Assigned</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/tickets/${t.id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.clients?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[t.status]}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[t.priority]}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.profiles?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(t.created_at).toLocaleDateString()}
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
