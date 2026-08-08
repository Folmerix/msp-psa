"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";

type Client = { id: string; name: string };

const inputCls = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

const COMMON_VENDORS = ["Pax8", "Microsoft", "Google", "Foxit", "Datto", "Acronis", "Veeam", "Webroot", "Malwarebytes", "Huntress", "ConnectWise", "Other"];

export default function NewSubscriptionPage() {
  return <Suspense><NewSubscriptionForm /></Suspense>;
}

function NewSubscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClient = searchParams.get("client") ?? "";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    client_id: preselectedClient,
    type: "software_license",
    vendor: "",
    product_name: "",
    seats: "1",
    cost_per_seat: "",
    price_per_seat: "",
    discount_percent: "",
    billing_day: "1",
    start_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const isSoftware = form.type === "software_license";

  useEffect(() => {
    supabase.from("clients").select("id, name").eq("active", true).order("name")
      .then(({ data }) => setClients(data ?? []));
  }, []);

  const seats = parseFloat(form.seats || "0");
  const cost = parseFloat(form.cost_per_seat || "0");
  const price = parseFloat(form.price_per_seat || "0");
  const discount = parseFloat(form.discount_percent || "0");
  const monthlyCost = seats * cost;
  const grossRevenue = seats * price;
  const discountAmount = grossRevenue * (discount / 100);
  const monthlyRevenue = grossRevenue - discountAmount;
  const monthlyMargin = monthlyRevenue - monthlyCost;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    const { error } = await supabase.from("subscriptions").insert({
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
      status: "active",
    });
    if (error) { setError(error.message); setLoading(false); }
    else router.push("/dashboard/subscriptions");
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Subscriptions</p>
            <h1 className="text-xl font-bold text-gray-900">Add Subscription</h1>
          </div>
        </div>
        <button type="button" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm">
          {loading ? "Saving…" : "Save Subscription"}
        </button>
      </div>

      <div className="flex gap-6 p-8 pt-6 overflow-y-auto flex-1">
        <form onSubmit={handleSubmit} className="flex-1 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

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

          {/* Client + Details */}
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
                  <input list="vendors" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} required={isSoftware} className={inputCls} placeholder="e.g. Pax8, Microsoft" />
                  <datalist id="vendors">
                    {COMMON_VENDORS.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
              )}
              <div>
                <label className={labelCls}>{isSoftware ? "Product / Service Name *" : "Package Name *"}</label>
                <input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} required className={inputCls} placeholder={isSoftware ? "e.g. Microsoft 365 Business Premium" : "e.g. Basic IT Support Package"} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder={isSoftware ? "e.g. Includes Teams, Exchange, SharePoint" : "e.g. Remote support, patch management, monitoring"} />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Pricing</h2>
            <div className={`grid gap-5 ${isSoftware ? "grid-cols-3" : "grid-cols-2"}`}>
              <div>
                <label className={labelCls}>{isSoftware ? "Seats / Licenses *" : "Units *"}</label>
                <input type="number" min="1" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} required className={inputCls} placeholder="1" />
              </div>
              {isSoftware && (
                <div>
                  <label className={labelCls}>Your Cost / Seat *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={form.cost_per_seat} onChange={e => setForm(f => ({ ...f, cost_per_seat: e.target.value }))} required={isSoftware} className={inputCls + " pl-7"} placeholder="0.00" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">What Pax8 / vendor charges you</p>
                </div>
              )}
              <div>
                <label className={labelCls}>{isSoftware ? "List Price / Seat *" : "Monthly Price *"}</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={form.price_per_seat} onChange={e => setForm(f => ({ ...f, price_per_seat: e.target.value }))} required className={inputCls + " pl-7"} placeholder="0.00" />
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
                  <p className="text-xs text-gray-400 mt-1">Discount for MSP clients (leave blank for none)</p>
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

            {/* Live margin preview */}
            {(cost > 0 || price > 0) && (
              <div className={`bg-gray-50 rounded-lg p-4 grid gap-4 text-center text-sm ${isSoftware ? "grid-cols-3" : "grid-cols-2"}`}>
                {isSoftware && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Monthly Cost</p>
                    <p className="font-bold text-gray-900">${monthlyCost.toFixed(2)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Net Revenue</p>
                  <p className="font-bold text-blue-600">${monthlyRevenue.toFixed(2)}</p>
                  {discount > 0 && <p className="text-xs text-gray-400 mt-0.5 line-through">${grossRevenue.toFixed(2)}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{isSoftware ? "Monthly Margin" : "Pure Margin"}</p>
                  <p className={`font-bold ${monthlyMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${monthlyMargin.toFixed(2)} ({monthlyRevenue > 0 ? ((monthlyMargin / monthlyRevenue) * 100).toFixed(0) : 0}%)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Billing */}
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
                    <option key={d} value={d}>{d === 1 ? "1st (start of month)" : d === 28 ? "28th (end of month)" : `${d}th`}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Day invoices are generated</p>
              </div>
            </div>
          </div>
        </form>

        {/* Help panel */}
        <div className="w-72 flex-shrink-0 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">How This Works</p>
            <ul className="space-y-3 text-sm text-blue-800">
              <li className="flex gap-2"><span className="font-bold mt-0.5">1.</span>You enter the subscription once with your cost and client price.</li>
              <li className="flex gap-2"><span className="font-bold mt-0.5">2.</span>Each month, click "Run Monthly Billing" on the Subscriptions page.</li>
              <li className="flex gap-2"><span className="font-bold mt-0.5">3.</span>Draft invoices are created for each client automatically.</li>
              <li className="flex gap-2"><span className="font-bold mt-0.5">4.</span>You review and send. Done.</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tips</p>
            <ul className="space-y-3 text-sm text-gray-500">
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>Add one subscription per product per client — even if same vendor.</li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>When seat count changes on Pax8, just edit and update seats here.</li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>To stop billing, edit and set status to Cancelled — no data is lost.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
