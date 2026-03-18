"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
};

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};

const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  waiting: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-600",
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setClient(data as Client);
        setForm({
          name: data.name,
          email: data.email ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
        });
      }
    });

    supabase
      .from("tickets")
      .select("id, title, status, priority, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setTickets((data as Ticket[]) ?? []));
  }, [id]);

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("clients").update({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
    }).eq("id", id);
    setClient((c) => c ? { ...c, ...form } : c);
    setSaving(false);
    setEditing(false);
  }

  if (!client) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm mb-4 block">
        ← Back
      </button>

      {/* Client info */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">{client.name}</h1>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="text-sm text-gray-500 hover:text-black"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-3">
            {[
              { id: "name", label: "Name", type: "text", value: form.name },
              { id: "email", label: "Email", type: "email", value: form.email },
              { id: "phone", label: "Phone", type: "tel", value: form.phone },
              { id: "address", label: "Address", type: "text", value: form.address },
            ].map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="block text-sm font-medium mb-1">{f.label}</label>
                <input
                  id={f.id}
                  type={f.type}
                  value={f.value}
                  onChange={(e) => setField(f.id, e.target.value)}
                  required={f.id === "name"}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-400">Email</p><p>{client.email ?? "—"}</p></div>
            <div><p className="text-gray-400">Phone</p><p>{client.phone ?? "—"}</p></div>
            <div className="col-span-2"><p className="text-gray-400">Address</p><p>{client.address ?? "—"}</p></div>
          </div>
        )}
      </div>

      {/* Tickets for this client */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Tickets</h2>
          <Link
            href={`/dashboard/tickets/new?client=${id}`}
            className="text-sm bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-800"
          >
            + New Ticket
          </Link>
        </div>

        {tickets.length === 0 ? (
          <p className="text-sm text-gray-400">No tickets for this client.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/tickets/${t.id}`}
                className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-gray-50 rounded px-2"
              >
                <span className="text-sm font-medium">{t.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[t.status]}`}>
                  {t.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
