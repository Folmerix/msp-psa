"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  clients: { name: string } | null;
  profiles: { full_name: string } | null;
};

type TimeEntry = {
  id: string;
  minutes: number;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
};

const statuses = ["open", "in_progress", "waiting", "closed"];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [logMinutes, setLogMinutes] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  async function loadTicket() {
    const { data } = await supabase
      .from("tickets")
      .select("id, title, description, status, priority, created_at, clients(name), profiles!tickets_assigned_to_fkey(full_name)")
      .eq("id", id)
      .single();
    setTicket(data as unknown as Ticket);
  }

  async function loadTime() {
    const { data } = await supabase
      .from("time_entries")
      .select("id, minutes, notes, created_at, profiles(full_name)")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false });
    setTimeEntries((data as unknown as TimeEntry[]) ?? []);
  }

  useEffect(() => {
    loadTicket();
    loadTime();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(status: string) {
    await supabase.from("tickets").update({ status }).eq("id", id);
    setTicket((t) => t ? { ...t, status } : t);
  }

  async function logTime(e: React.FormEvent) {
    e.preventDefault();
    setLogLoading(true);
    const { data: session } = await supabase.auth.getSession();
    await supabase.from("time_entries").insert({
      ticket_id: id,
      user_id: session.session?.user.id,
      minutes: parseInt(logMinutes),
      notes: logNotes || null,
    });
    setLogMinutes("");
    setLogNotes("");
    setLogLoading(false);
    loadTime();
  }

  const totalMinutes = timeEntries.reduce((sum, e) => sum + e.minutes, 0);

  if (!ticket) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm mb-4 block">
        ← Back
      </button>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-semibold">{ticket.title}</h1>
          <select
            value={ticket.status}
            onChange={(e) => updateStatus(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm mb-4">
          <div>
            <p className="text-gray-400">Client</p>
            <p className="font-medium">{ticket.clients?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400">Assigned To</p>
            <p className="font-medium">{ticket.profiles?.full_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400">Priority</p>
            <p className="font-medium capitalize">{ticket.priority}</p>
          </div>
        </div>

        {ticket.description && (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</p>
        )}
      </div>

      {/* Time logging */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Time Entries</h2>
          <span className="text-sm text-gray-500">
            Total: {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
          </span>
        </div>

        <form onSubmit={logTime} className="flex gap-3 mb-5">
          <input
            type="number"
            min="1"
            placeholder="Minutes"
            value={logMinutes}
            onChange={(e) => setLogMinutes(e.target.value)}
            required
            className="w-28 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={logNotes}
            onChange={(e) => setLogNotes(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            type="submit"
            disabled={logLoading}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            Log
          </button>
        </form>

        {timeEntries.length === 0 ? (
          <p className="text-sm text-gray-400">No time logged yet.</p>
        ) : (
          <div className="space-y-2">
            {timeEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <div>
                  <span className="font-medium">{e.profiles?.full_name ?? "—"}</span>
                  {e.notes && <span className="text-gray-500 ml-2">{e.notes}</span>}
                </div>
                <div className="text-right text-gray-500">
                  <span>{Math.floor(e.minutes / 60)}h {e.minutes % 60}m</span>
                  <span className="ml-3">{new Date(e.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
