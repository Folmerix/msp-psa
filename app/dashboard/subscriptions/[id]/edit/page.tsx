"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = { id: string; name: string };

const inputCls = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

const COMMON_VENDORS = ["Pax8", "Microsoft", "Google", "Foxit", "Datto", "Acronis", "Veeam", "Webroot", "Malwarebytes", "Huntress", "ConnectWise", "Other"];

export default function EditSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    client_id: "", type: "software_license", vendor: "", product_name: "", seats: "1",
    cost_per_seat: "", price_per_seat: "", discount_percent: "", billing_day: "1",
    start_date: "", notes: "", status: "active",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("clients").select("id, name").eq("active", true).order("name"),
      supabase.from("subscriptions").select("*").eq("id", id).single(),
    ]).then(([cl, sub]) => {
      setClients(cl.data ?? []);
      if (sub.data) {
        const s = sub.data;
        setForm({
          client_id: s.client_id ?? "",
          type: s.type ?? "software_license",
          vendor: s.vendor ?? "",
          product_name: s.product_name ?? "",
          seats: String(s.seats ?? 1),
          cost_per_seat: String(s.cost_per_seat ?? ""),
          price_per_seat: String(s.price_per_seat ?? ""),
          discount_percent: s.discount_percent ? String(s.discount_percent) : "",
          billing_day: String(s.billing_day ?? 1),
          start_date: s.start_date ?? "",
          notes: s.notes ?? "",
          status: s.status ?? "active",
        });
      }
      setLoading(false);
    });
  }, [id]);

  const isSoftware = form.type === "software_license";
  const seats = parseFloat(form.seats || "0");
  const cost = parseFloat(form.cost_per_seat || "0");
  const price = parseFloat(form.price_per_seat || "0");
  const discount = parseFloat(form.discount_percent || "0");
  const monthlyCost = seats * cost;
  const grossRevenue = seats * price;
  const discountAmount = grossRevenue * (discount / 100);
  const monthlyRevenue = grossRevenue - discountAmount;
  const monthlyMargin = monthlyRevenue - monthlyCost;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSaving(true);
    const { error } = await supabase.from("subscriptions").update({
      client_id: form.client_id || null,
      type: form.type,
      vendor: isSoftware ? form.vendor : "",
      product_name: form.product_name,
      seats: parseInt(form.seats),
      cost_per_seat: isSoftware ? parseFloat(form.cost_per_seat) : 0,
      price_per_seat: parseFloat(form.price_per_seat),
      discount_percent: parseFloat(form.discount_percent) || 0,
      billing_day: parseInt(form.billing_day),
      start_date: form.start_date,
      notes: form.notes || null,
    }).eq("id", id);
    if (error) { setError(error.message); setSaving(false); }
    else router.push("/dashboard/subscriptions");
  }

  async function handleCancel() {
    setCancelling(true);
    await supabase.from("subscriptions").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString().split("T")[0],
    }).eq("id", id);
    router.push("/dashboard/subscriptions");
  }

  async function handleReactivate() {
    await supabase.from("subscriptions").update({ status: "active", cancelled_at: null }).eq("id", id);
    setForm(f => ({ ...f, status: "active" }));
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Subscriptions</p>
            <h1 className="text-xl font-bold text-gray-900">Edit Subscription</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {form.status === "active" ? (
            <button type="button" onClick={handleCancel} disabled={cancelling}
              className="border border-red-200 text-red-500 bg-white hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
              {cancelling ? "Cancelling…" : "Cancel Subscription"}
            </button>
          ) : (
            <button type="button" onClick={handleReactivate}
              className="border border-green-200 text-green-600 bg-white hover:bg-green-50 text-sm font-medium px-4 py-2 rounded-lg transition">
              Reactivate
            </button>
          )}
          <button type="button" onClick={handleSave as unknown as React.MouseEventHandler} disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="flex gap-6 p-8 pt-6 overflow-y-auto flex-1">
        <form onSubmit={handleSave} className="flex-1 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          {form.status === "cancelled" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-amber-800 text-sm font-medium">
              This subscription is cancelled and will not be included in monthly billing.
            </div>
          )}

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => setForm(f => ({ ...f, type: "software_license" }))}
              className={`rounded-xl border-2 p-4 text-left transition ${form.type === "software_license" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
              <div className="flex items-center gap-3 mb-1">
                <svg width="18" height="18" fill="none" stroke={form.type === "software_license" ? "#3b82f6" : "#9ca3af"} strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                <span className={`text-sm font-bold ${form.type === "software_license" ? "text-blue-700" : "text-gray-700"}`}>Software License</span>
              </div>
              <p className="text-xs text-gray-400 ml-7">Pax8, Microsoft, Google, etc. Has a vendor cost you pass through.</p>
            </button>
            <button type="button" onClick={() => setForm(f => ({ ...f, type: "managed_service" }))}
              className={`rounded-xl border-2 p-4 text-left transition ${form.type === "managed_service" ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
              <div className="flex items-center gap-3 mb-1">
                <svg width="18" height="18" fill="none" stroke={form.type === "managed_service" ? "#a855f7" : "#9ca3af"} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm9 11v-1a7 7 0 0 0-7-7h-4a7 7 0 0 0-7 7v1"/></svg>
                <span className={`text-sm font-bold ${form.type === "managed_service" ? "text-purple-700" : "text-gray-700"}`}>Managed Service</span>
              </div>
              <p className="text-xs text-gray-400 ml-7">Your MSP monthly package. No vendor cost — pure service revenue.</p>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Subscription Details</h2>
            <div>
              <label className={labelCls}>Client</label>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inputCls}>
                <option value="">— No client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={`grid gap-5 ${isSoftware ? "grid-cols-2" : "grid-cols-1"}`}>
              {isSoftware && (
                <div>
                  <label className={labelCls}>Vendor</label>
                  <input list="vendors" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} required={isSoftware} className={inputCls} />
                  <datalist id="vendors">{COMMON_VENDORS.map(v => <option key={v} value={v} />)}</datalist>
                </div>
              )}
              <div>
                <label className={labelCls}>{isSoftware ? "Product / Service Name *" : "Package Name *"}</label>
                <input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} required className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Pricing</h2>
            <div className={`grid gap-5 ${isSoftware ? "grid-cols-3" : "grid-cols-2"}`}>
              <div>
                <label className={labelCls}>{isSoftware ? "Seats / Licenses *" : "Units *"}</label>
                <input type="number" min="1" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} required className={inputCls} />
              </div>
              {isSoftware && (
                <div>
                  <label className={labelCls}>Your Cost / Seat *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={form.cost_per_seat} onChange={e => setForm(f => ({ ...f, cost_per_seat: e.target.value }))} required={isSoftware} className={inputCls + " pl-7"} />
                  </div>
                </div>
              )}
              <div>
                <label className={labelCls}>{isSoftware ? "List Price / Seat *" : "Monthly Price *"}</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={form.price_per_seat} onChange={e => setForm(f => ({ ...f, price_per_seat: e.target.value }))} required className={inputCls + " pl-7"} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Full price before any discount</p>
              </div>
            </div>

            {/* Discount (software only) */}
            {isSoftware && (
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className={labelCls}>MSP Discount %</label>
                  <div className="relative">
                    <input type="number" min="0" max="100" step="0.1" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} className={inputCls + " pr-7"} placeholder="0" />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Discount for MSP clients</p>
                </div>
                {discount > 0 && (
                  <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex items-center gap-3">
                    <svg width="16" height="16" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    <p className="text-sm text-amber-800">
                      Client pays <strong>${(price - price * discount / 100).toFixed(2)}/seat</strong> (saves ${(price * discount / 100).toFixed(2)}/seat · ${discountAmount.toFixed(2)}/mo total)
                    </p>
                  </div>
                )}
              </div>
            )}

            {(cost > 0 || price > 0) && (
              <div className={`bg-gray-50 rounded-lg p-4 grid gap-4 text-center text-sm ${isSoftware ? "grid-cols-3" : "grid-cols-2"}`}>
                {isSoftware && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Monthly Cost</p><p className="font-bold text-gray-900">${monthlyCost.toFixed(2)}</p></div>}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Net Revenue</p>
                  <p className="font-bold text-blue-600">${monthlyRevenue.toFixed(2)}</p>
                  {discount > 0 && <p className="text-xs text-gray-400 mt-0.5 line-through">${grossRevenue.toFixed(2)}</p>}
                </div>
                <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{isSoftware ? "Monthly Margin" : "Pure Margin"}</p><p className={`font-bold ${monthlyMargin >= 0 ? "text-green-600" : "text-red-600"}`}>${monthlyMargin.toFixed(2)} ({monthlyRevenue > 0 ? ((monthlyMargin / monthlyRevenue) * 100).toFixed(0) : 0}%)</p></div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Billing</h2>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Billing Day of Month</label>
                <select value={form.billing_day} onChange={e => setForm(f => ({ ...f, billing_day: e.target.value }))} className={inputCls}>
                  {[1, 5, 10, 15, 20, 25, 28].map(d => (
                    <option key={d} value={d}>{d === 1 ? "1st" : d === 28 ? "28th" : `${d}th`}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </form>

        <div className="w-72 flex-shrink-0 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">When to Update</p>
            <ul className="space-y-3 text-sm text-gray-500">
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>Update <strong className="text-gray-700">Seats</strong> when your client adds or removes licenses on Pax8.</li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>Update <strong className="text-gray-700">Cost</strong> when Pax8 changes their pricing.</li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>Click <strong className="text-gray-700">Cancel Subscription</strong> when the client stops the service — it stops billing automatically.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
