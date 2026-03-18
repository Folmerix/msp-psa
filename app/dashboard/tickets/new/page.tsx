"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = { id: string; name: string };
type Profile = { id: string; full_name: string };

export default function NewTicketPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [engineers, setEngineers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    client_id: "",
    assigned_to: "",
  });

  useEffect(() => {
    supabase.from("clients").select("id, name").eq("active", true).then(({ data }) => {
      setClients(data ?? []);
    });
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      setEngineers(data ?? []);
    });
  }, []);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;

    const { error } = await supabase.from("tickets").insert({
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      client_id: form.client_id || null,
      assigned_to: form.assigned_to || null,
      created_by: userId,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard/tickets");
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-semibold">New Ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">Title *</label>
          <input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="priority" className="block text-sm font-medium mb-1">Priority</label>
            <select
              id="priority"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label htmlFor="client" className="block text-sm font-medium mb-1">Client</label>
            <select
              id="client"
              value={form.client_id}
              onChange={(e) => set("client_id", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">— None —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="assigned" className="block text-sm font-medium mb-1">Assign To</label>
          <select
            id="assigned"
            value={form.assigned_to}
            onChange={(e) => set("assigned_to", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">— Unassigned —</option>
            {engineers.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Ticket"}
        </button>
      </form>
    </div>
  );
}
