"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Ticket = {
  id: string; title: string; description: string | null; status: string; priority: string; created_at: string;
  clients: { name: string } | null; profiles: { full_name: string } | null;
};
type TimeEntry = {
  id: string; minutes: number; notes: string | null; billable: boolean; created_at: string;
  profiles: { full_name: string } | null;
};

const statuses = ["open", "in_progress", "waiting", "closed"];
const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};
const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  waiting: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-600",
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [logMinutes, setLogMinutes] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logBillable, setLogBillable] = useState(true);
  const [logLoading, setLogLoading] = useState(false);

  async function loadTicket() {
    const { data } = await supabase.from("tickets")
      .select("id, title, description, status, priority, created_at, clients(name), profiles!tickets_assigned_to_fkey(full_name)")
      .eq("id", id).single();
    setTicket(data as unknown as Ticket);
  }

  async function loadTime() {
    const { data } = await supabase.from("time_entries")
      .select("id, minutes, notes, billable, created_at, profiles(full_name)")
      .eq("ticket_id", id).order("created_at", { ascending: false });
    setTimeEntries((data as unknown as TimeEntry[]) ?? []);
  }

  useEffect(() => { loadTicket(); loadTime(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateStatus(status: string) {
    await supabase.from("tickets").update({ status }).eq("id", id);
    setTicket(t => t ? { ...t, status } : t);
  }

  async function logTime(e: React.FormEvent) {
    e.preventDefault(); setLogLoading(true);
    const { data: session } = await supabase.auth.getSession();
    await supabase.from("time_entries").insert({ ticket_id: id, user_id: session.session?.user.id, minutes: parseInt(logMinutes), notes: logNotes || null, billable: logBillable });
    setLogMinutes(""); setLogNotes(""); setLogBillable(true);
    setLogLoading(false); loadTime();
  }

  const totalMinutes = timeEntries.reduce((s, e) => s + e.minutes, 0);
  const billableMinutes = timeEntries.filter(e => e.billable).reduce((s, e) => s + e.minutes, 0);

  if (!ticket) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tickets</p>
            <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
          </div>
        </div>
        <select value={ticket.status} onChange={e => updateStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {statuses.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>

      <div className="p-8 pt-6 space-y-5 overflow-y-auto flex-1">

        {/* Metadata row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Client", value: ticket.clients?.name ?? "—" },
            { label: "Assigned To", value: ticket.profiles?.full_name ?? "Unassigned" },
            { label: "Priority", badge: ticket.priority, colors: priorityColors[ticket.priority] },
            { label: "Status", badge: ticket.status.replace("_", " "), colors: statusColors[ticket.status] },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{card.label}</p>
              {card.badge
                ? <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${card.colors}`}>{card.badge}</span>
                : <p className="text-sm font-semibold text-gray-900">{card.value}</p>
              }
            </div>
          ))}
        </div>

        {/* Description */}
        {ticket.description && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Description</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>
        )}

        {/* Time entries */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">Time Entries</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">Total: <span className="font-semibold text-gray-900">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span></span>
              <span className="text-green-600">Billable: <span className="font-semibold">{Math.floor(billableMinutes / 60)}h {billableMinutes % 60}m</span></span>
            </div>
          </div>

          {/* Log time form */}
          <form onSubmit={logTime} className="flex gap-3 px-6 py-4 bg-gray-50 border-b border-gray-100 items-center">
            <input type="number" min="1" placeholder="Minutes" value={logMinutes} onChange={e => setLogMinutes(e.target.value)} required
              className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" placeholder="Notes (optional)" value={logNotes} onChange={e => setLogNotes(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={logBillable} onChange={e => setLogBillable(e.target.checked)} className="rounded" />
              Billable
            </label>
            <button type="submit" disabled={logLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition">
              Log Time
            </button>
          </form>

          {timeEntries.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">No time logged yet.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {timeEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{e.profiles?.full_name ?? "—"}</span>
                    {e.notes && <span className="text-sm text-gray-500">{e.notes}</span>}
                    {e.billable
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Billable</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Non-billable</span>
                    }
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <span className="font-semibold text-gray-900">{Math.floor(e.minutes / 60)}h {e.minutes % 60}m</span>
                    <span className="ml-3">{new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
