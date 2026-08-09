"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Client = { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null; active: boolean };
type Ticket = { id: string; title: string; status: string; priority: string; created_at: string };
type Contract = { id: string; name: string; amount: number; status: string; last_billed_at: string | null };
type Subscription = { id: string; type: string; vendor: string | null; product_name: string; seats: number; price_per_seat: number; discount_percent: number; status: string };

const ticketStatusColors: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  waiting: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-600",
};

const inputCls = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" });
  const [saving, setSaving] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setClient(data as Client);
        setForm({ name: data.name, email: data.email ?? "", phone: data.phone ?? "", address: data.address ?? "", city: data.city ?? "", state: data.state ?? "", zip: data.zip ?? "" });
      }
    });
    supabase.from("tickets").select("id, title, status, priority, created_at").eq("client_id", id).order("created_at", { ascending: false })
      .then(({ data }) => setTickets((data as Ticket[]) ?? []));
    supabase.from("contracts").select("id, name, amount, status, last_billed_at").eq("client_id", id).order("created_at", { ascending: false })
      .then(({ data }) => setContracts((data as Contract[]) ?? []));
    supabase.from("subscriptions").select("id, type, vendor, product_name, seats, price_per_seat, discount_percent, status").eq("client_id", id).eq("status", "active").order("vendor")
      .then(({ data }) => setSubscriptions((data as Subscription[]) ?? []));
  }, [id]);

  const netRevenue = (s: Subscription) => s.seats * s.price_per_seat * (1 - (s.discount_percent || 0) / 100);

  async function generateInvoice() {
    if (subscriptions.length === 0) return;
    setGeneratingInvoice(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: maxRow } = await supabase
      .from("invoices")
      .select("invoice_number")
      .order("invoice_number", { ascending: false })
      .limit(1)
      .single();
    const lastNum = maxRow?.invoice_number ? parseInt(maxRow.invoice_number.replace(/\D/g, ""), 10) : 0;
    const invoiceNumber = `INV-${String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(4, "0")}`;

    const now = new Date();
    const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });
    const subtotal = subscriptions.reduce((sum, s) => sum + netRevenue(s), 0);

    const { data: inv, error } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      client_id: id,
      title: `Monthly Subscriptions — ${monthLabel}`,
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total: subtotal,
      status: "draft",
      created_by: user?.id ?? null,
    }).select().single();

    if (error || !inv) { setGeneratingInvoice(false); return; }

    const lineItems: object[] = [];
    let sortIdx = 0;
    for (const s of subscriptions) {
      const itemName = (s.vendor && s.vendor !== "") ? `${s.vendor} — ${s.product_name}` : s.product_name;
      const gross = s.seats * s.price_per_seat;
      lineItems.push({
        invoice_id: inv.id,
        item_name: itemName,
        description: s.type === "managed_service"
          ? s.product_name
          : `${s.seats} seat${s.seats !== 1 ? "s" : ""} × $${s.price_per_seat.toFixed(2)}/seat`,
        quantity: s.seats,
        unit_price: s.price_per_seat,
        sort_order: sortIdx++,
      });
      if (s.discount_percent > 0) {
        const discAmt = gross * (s.discount_percent / 100);
        lineItems.push({
          invoice_id: inv.id,
          item_name: `MSP Package Discount (${s.discount_percent}%)`,
          description: `Discount applied for managed service clients`,
          quantity: 1,
          unit_price: -discAmt,
          sort_order: sortIdx++,
        });
      }
    }
    await supabase.from("line_items").insert(lineItems);
    await supabase.from("subscriptions")
      .update({ last_billed_at: now.toISOString().split("T")[0] })
      .in("id", subscriptions.map(s => s.id));

    setGeneratingInvoice(false);
    router.push(`/dashboard/invoices/${inv.id}`);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await supabase.from("clients").update({ name: form.name, email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, state: form.state || null, zip: form.zip || null }).eq("id", id);
    setClient(c => c ? { ...c, ...form } : c);
    setSaving(false); setEditing(false);
  }

  if (!client) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Clients</p>
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(!editing)}
          className="border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition">
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      <div className="p-8 pt-6 space-y-5 overflow-y-auto flex-1">

        {/* Client info card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {editing ? (
            <form onSubmit={handleSave}>
              <h2 className="text-sm font-bold text-gray-700 mb-5 pb-3 border-b border-gray-100">Edit Client</h2>
              <div className="grid grid-cols-2 gap-5 mb-5">
                <div className="col-span-2">
                  <label className={labelCls}>Company Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inputCls} placeholder="Acme Corp" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="contact@acme.com" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="(555) 000-0000" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Street Address</label>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} placeholder="123 Main St" />
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} placeholder="Houston" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>State</label>
                    <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inputCls} placeholder="TX" />
                  </div>
                  <div>
                    <label className={labelCls}>ZIP</label>
                    <input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} className={inputCls} placeholder="77001" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-50 transition">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </form>
          ) : (
            <>
              <h2 className="text-sm font-bold text-gray-700 mb-5 pb-3 border-b border-gray-100">Contact Information</h2>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Email</p>
                  <p className="text-gray-900">{client.email ? <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">{client.email}</a> : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                  <p className="text-gray-900">{client.phone ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Address</p>
                  <p className="text-gray-900">
                    {[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Subscriptions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-700">Active Subscriptions</h2>
              {subscriptions.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  ${subscriptions.reduce((s, sub) => s + sub.seats * sub.price_per_seat, 0).toFixed(2)}/month
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {subscriptions.length > 0 && (
                <button onClick={generateInvoice} disabled={generatingInvoice}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                  {generatingInvoice ? "Creating…" : "Generate Invoice"}
                </button>
              )}
              <Link href={`/dashboard/subscriptions/new?client=${id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                + Add Subscription
              </Link>
            </div>
          </div>
          {subscriptions.length === 0 ? (
            <div className="px-6 py-6 text-center text-sm text-gray-400">No active subscriptions for this client.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {subscriptions.map(s => (
                <div key={s.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{s.product_name}</p>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${s.type === "managed_service" ? "bg-purple-100 text-purple-700" : "bg-blue-50 text-blue-600"}`}>
                        {s.type === "managed_service" ? "Service" : "License"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{(s.vendor && s.vendor !== "") ? `${s.vendor} · ` : ""}{s.seats} seat{s.seats !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-gray-900">${(s.seats * s.price_per_seat).toFixed(2)}/mo</span>
                    <Link href={`/dashboard/subscriptions/${s.id}/edit`} className="text-xs text-gray-400 hover:text-blue-600 transition">Edit</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contracts + Tickets side by side */}
        <div className="grid grid-cols-2 gap-5">

          {/* Contracts */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">Contracts</h2>
              <Link href={`/dashboard/contracts/new?client=${id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                + New Contract
              </Link>
            </div>
            {contracts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">No contracts for this client.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {contracts.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Last billed: {c.last_billed_at ? new Date(c.last_billed_at + "T12:00:00").toLocaleDateString() : "Never"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">${c.amount.toFixed(2)}/mo</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${c.status === "active" ? "bg-green-100 text-green-700" : c.status === "paused" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tickets */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">Tickets</h2>
              <Link href={`/dashboard/tickets/new?client=${id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                + New Ticket
              </Link>
            </div>
            {tickets.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">No tickets for this client.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {tickets.map(t => (
                  <Link key={t.id} href={`/dashboard/tickets/${t.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                    <p className="text-sm font-medium text-gray-900">{t.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ticketStatusColors[t.status]}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
