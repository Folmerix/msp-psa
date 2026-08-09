"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Subscription = {
  id: string;
  type: string;
  vendor: string | null;
  product_name: string;
  seats: number;
  cost_per_seat: number;
  price_per_seat: number;
  discount_percent: number;
  billing_day: number;
  start_date: string;
  status: string;
  last_billed_at: string | null;
  notes: string | null;
  clients: { id: string; name: string } | null;
};

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"active" | "cancelled">("active");

  async function load() {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, type, vendor, product_name, seats, cost_per_seat, price_per_seat, discount_percent, billing_day, start_date, status, last_billed_at, notes, clients(id, name)")
      .order("vendor").order("product_name");
    setSubs((data as unknown as Subscription[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const shown = subs.filter(s => s.status === filterStatus);
  const active = subs.filter(s => s.status === "active");

  const netRevenue = (s: Subscription) => s.seats * s.price_per_seat * (1 - (s.discount_percent || 0) / 100);
  const totalMRR = active.reduce((sum, s) => sum + netRevenue(s), 0);
  const totalCost = active.reduce((sum, s) => sum + s.seats * s.cost_per_seat, 0);
  const totalMargin = totalMRR - totalCost;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Recurring services billed monthly to your clients</p>
        </div>
        <Link href="/dashboard/subscriptions/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm">
          + Add Subscription
        </Link>
      </div>

      <div className="p-8 pt-6 space-y-5 overflow-y-auto flex-1">

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Active Subscriptions", value: active.length.toString(), sub: "across all clients", color: "text-blue-600" },
            { label: "Monthly Revenue", value: `$${totalMRR.toFixed(2)}`, sub: "billed to clients", color: "text-gray-900" },
            { label: "Monthly Cost", value: `$${totalCost.toFixed(2)}`, sub: "paid to vendors", color: "text-gray-900" },
            { label: "Monthly Margin", value: `$${totalMargin.toFixed(2)}`, sub: `${totalMRR > 0 ? ((totalMargin / totalMRR) * 100).toFixed(0) : 0}% margin`, color: "text-green-600" },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(["active", "cancelled"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition capitalize ${filterStatus === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {shown.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-gray-400 text-sm mb-3">No {filterStatus} subscriptions yet.</p>
              {filterStatus === "active" && (
                <Link href="/dashboard/subscriptions/new" className="text-blue-600 text-sm font-semibold hover:underline">+ Add your first subscription</Link>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product / Service</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Seats</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Cost</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client Price</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Margin</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Billed</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shown.map(s => {
                  const gross = s.seats * s.price_per_seat;
                  const monthly = netRevenue(s);
                  const cost = s.seats * s.cost_per_seat;
                  const margin = monthly - cost;
                  const hasDiscount = s.discount_percent > 0;
                  const notBilledThisMonth = !s.last_billed_at || new Date(s.last_billed_at) < monthStart;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {s.clients
                          ? <Link href={`/dashboard/clients/${s.clients.id}`} className="font-semibold text-blue-600 hover:underline">{s.clients.name}</Link>
                          : <span className="text-gray-400 italic">No client</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{s.product_name}</p>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${s.type === "managed_service" ? "bg-purple-100 text-purple-700" : "bg-blue-50 text-blue-600"}`}>
                            {s.type === "managed_service" ? "Service" : "License"}
                          </span>
                          {hasDiscount && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                              {s.discount_percent}% off
                            </span>
                          )}
                        </div>
                        {s.vendor ? <p className="text-xs text-gray-400 mt-0.5">{s.vendor}</p> : null}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">{s.seats}</td>
                      <td className="px-6 py-4 text-right text-gray-500">${s.cost_per_seat.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        {hasDiscount ? (
                          <>
                            <span className="line-through text-gray-400 text-xs">${s.price_per_seat.toFixed(2)}</span>
                            <span className="ml-1">${(s.price_per_seat * (1 - s.discount_percent / 100)).toFixed(2)}</span>
                          </>
                        ) : `$${s.price_per_seat.toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        ${monthly.toFixed(2)}
                        {hasDiscount && <span className="text-xs text-gray-400 ml-1 line-through">${gross.toFixed(2)}</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-green-700 font-semibold">${margin.toFixed(2)}</span>
                        <span className="text-xs text-gray-400 ml-1">({monthly > 0 ? ((margin / monthly) * 100).toFixed(0) : 0}%)</span>
                      </td>
                      <td className="px-6 py-4">
                        {s.last_billed_at ? (
                          <div className="flex items-center gap-2">
                            <span className={notBilledThisMonth && s.status === "active" ? "text-amber-600 font-medium" : "text-gray-500"}>
                              {new Date(s.last_billed_at + "T12:00:00").toLocaleDateString()}
                            </span>
                            <button
                              onClick={async () => {
                                await supabase.from("subscriptions").update({ last_billed_at: null }).eq("id", s.id);
                                load();
                              }}
                              className="text-xs text-gray-300 hover:text-red-400 transition"
                              title="Reset billing date">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">Never billed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/dashboard/subscriptions/${s.id}/edit`} className="text-xs text-gray-400 hover:text-blue-600 font-medium transition">Edit</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
