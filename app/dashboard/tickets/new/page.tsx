"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const inputCls = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

type Client = { id: string; name: string };
type Profile = { id: string; full_name: string };

export default function NewTicketPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [engineers, setEngineers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", client_id: "", assigned_to: "" });

  useEffect(() => {
    supabase.from("clients").select("id, name").eq("active", true).then(({ data }) => setClients(data ?? []));
    supabase.from("profiles").select("id, full_name").then(({ data }) => setEngineers(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const { error } = await supabase.from("tickets").insert({
      title: form.title, description: form.description || null, priority: form.priority,
      client_id: form.client_id || null, assigned_to: form.assigned_to || null, created_by: session.session?.user.id,
    });
    if (error) { setError(error.message); setLoading(false); }
    else router.push("/dashboard/tickets");
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tickets</p>
            <h1 className="text-xl font-bold text-gray-900">New Ticket</h1>
          </div>
        </div>
        <button type="button" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm">
          {loading ? "Creating…" : "Create Ticket"}
        </button>
      </div>

      <div className="flex gap-6 p-8 pt-6 overflow-y-auto flex-1">
        <form onSubmit={handleSubmit} className="flex-1 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Ticket Details</h2>
            <div>
              <label className={labelCls}>Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className={inputCls} placeholder="Brief description of the issue" />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={5}
                className={inputCls + " resize-none"} placeholder="Steps to reproduce, error messages, impact…" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Assignment</h2>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className={labelCls}>Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Client</label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inputCls}>
                  <option value="">— None —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Assign To</label>
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className={inputCls}>
                  <option value="">— Unassigned —</option>
                  {engineers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </form>

        {/* Tips panel */}
        <div className="w-72 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Priority Guide</p>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2"><span className="text-red-500 font-bold mt-0.5">·</span><div><span className="font-semibold text-gray-800">Critical</span> <span className="text-gray-500">— System down, immediate response needed</span></div></li>
              <li className="flex gap-2"><span className="text-orange-400 font-bold mt-0.5">·</span><div><span className="font-semibold text-gray-800">High</span> <span className="text-gray-500">— Major feature broken, impacts daily work</span></div></li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span><div><span className="font-semibold text-gray-800">Medium</span> <span className="text-gray-500">— Issue exists but workaround is available</span></div></li>
              <li className="flex gap-2"><span className="text-gray-400 font-bold mt-0.5">·</span><div><span className="font-semibold text-gray-800">Low</span> <span className="text-gray-500">— Minor issue or enhancement request</span></div></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
