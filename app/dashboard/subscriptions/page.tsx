"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState(false);
  const [billResult, setBillResult] = useState<{ created: number; skipped: number } | null>(null);
  const [filterStatus, setFilterStatus] = useState<"active" | "cancelled">("active");
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [generatingSub, setGeneratingSub] = useState<string | null>(null);

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

  // Subscriptions not yet billed this month
  const dueToBill = active.filter(s => {
    if (!s.last_billed_at) return true;
    return new Date(s.last_billed_at) < monthStart;
  });

  async function runMonthlyBilling() {
    setBilling(true);
    setBillResult(null);

    // Group due subscriptions by client
    const byClient: Record<string, Subscription[]> = {};
    for (const s of dueToBill) {
      const cid = s.clients?.id ?? "no-client";
      if (!byClient[cid]) byClient[cid] = [];
      byClient[cid].push(s);
    }

    let created = 0;
    let skipped = 0;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: nextInv } = await supabase.rpc("next_document_number", { doc_type: "invoice" });
    let invCounter = nextInv ?? 1;

    for (const [clientId, clientSubs] of Object.entries(byClient)) {
      if (clientId === "no-client") { skipped += clientSubs.length; continue; }

      const subtotal = clientSubs.reduce((s, sub) => s + netRevenue(sub), 0);
      const invoiceNumber = `INV-${String(invCounter).padStart(4, "0")}`;
      invCounter++;

      const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });

      const { data: inv, error } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        client_id: clientId,
        title: `Monthly Subscriptions — ${monthLabel}`,
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        total: subtotal,
        status: "draft",
        created_by: user?.id ?? null,
      }).select().single();

      if (error || !inv) { skipped++; continue; }

      // Line items: one per subscription, plus discount line if applicable
      const lineItems: object[] = [];
      let sortIdx = 0;
      for (const s of clientSubs) {
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
        if (s.discount_percent && s.discount_percent > 0) {
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
      const { error: liError } = await supabase.from("line_items").insert(lineItems);
      if (liError) console.error("line_items insert failed:", liError.message);

      // Mark all billed
      await supabase.from("subscriptions")
        .update({ last_billed_at: now.toISOString().split("T")[0] })
        .in("id", clientSubs.map(s => s.id));

      created++;
    }

    setBillResult({ created, skipped });
    setBilling(false);
    setShowBillingModal(false);
    load();
  }

  async function generateSingleInvoice(s: Subscription) {
    if (!s.clients) return;
    setGeneratingSub(s.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: nextInv } = await supabase.rpc("next_document_number", { doc_type: "invoice" });
    const invoiceNumber = `INV-${String(nextInv ?? 1).padStart(4, "0")}`;
    const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });
    const amount = netRevenue(s);

    const { data: inv, error } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      client_id: s.clients.id,
      title: `Monthly Subscriptions — ${monthLabel}`,
      subtotal: amount,
      tax_rate: 0,
      tax_amount: 0,
      total: amount,
      status: "draft",
      created_by: user?.id ?? null,
    }).select().single();

    if (error || !inv) { setGeneratingSub(null); return; }

    const gross = s.seats * s.price_per_seat;
    const itemName = (s.vendor && s.vendor !== "") ? `${s.vendor} — ${s.product_name}` : s.product_name;
    const lineItems: object[] = [{
      invoice_id: inv.id,
      item_name: itemName,
      description: s.type === "managed_service"
        ? s.product_name
        : `${s.seats} seat${s.seats !== 1 ? "s" : ""} × $${s.price_per_seat.toFixed(2)}/seat`,
      quantity: s.seats,
      unit_price: s.price_per_seat,
      sort_order: 0,
    }];
    if (s.discount_percent > 0) {
      const discAmt = gross * (s.discount_percent / 100);
      lineItems.push({
        invoice_id: inv.id,
        item_name: `MSP Package Discount (${s.discount_percent}%)`,
        description: `Discount applied for managed service clients`,
        quantity: 1,
        unit_price: -discAmt,
        sort_order: 1,
      });
    }
    await supabase.from("line_items").insert(lineItems);
    await supabase.from("subscriptions")
      .update({ last_billed_at: now.toISOString().split("T")[0] })
      .eq("id", s.id);

    setGeneratingSub(null);
    router.push(`/dashboard/invoices/${inv.id}`);
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Recurring services billed monthly to your clients</p>
        </div>
        <div className="flex items-center gap-3">
          {dueToBill.length > 0 && (
            <button onClick={() => setShowBillingModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm flex items-center gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20"/></svg>
              Run Monthly Billing ({dueToBill.length} subscriptions)
            </button>
          )}
          <Link href="/dashboard/subscriptions/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm">
            + Add Subscription
          </Link>
        </div>
      </div>

      <div className="p-8 pt-6 space-y-5 overflow-y-auto flex-1">

        {/* Bill result banner */}
        {billResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800">Billing complete!</p>
              <p className="text-sm text-green-700">{billResult.created} invoice{billResult.created !== 1 ? "s" : ""} created as drafts. Review them in Invoices before sending.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard/invoices" className="text-sm font-semibold text-green-700 hover:text-green-900 underline">View Invoices →</Link>
              <button onClick={() => setBillResult(null)} className="text-green-500 hover:text-green-700">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        )}

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

        {/* Due to bill notice */}
        {dueToBill.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="20" height="20" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">{dueToBill.length} subscription{dueToBill.length !== 1 ? "s" : ""} not yet billed this month</p>
                <p className="text-xs text-amber-600">Click "Run Monthly Billing" to create draft invoices for all clients.</p>
              </div>
            </div>
            <button onClick={() => setShowBillingModal(true)}
              className="text-sm font-semibold text-amber-700 hover:text-amber-900 border border-amber-300 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-lg transition">
              Run Billing
            </button>
          </div>
        )}

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
                              title="Reset billing date (mark as unbilled)">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-medium">Never billed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {s.clients && (
                            <button
                              onClick={() => generateSingleInvoice(s)}
                              disabled={generatingSub === s.id}
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium transition disabled:opacity-50">
                              {generatingSub === s.id ? "Creating…" : "Generate Invoice"}
                            </button>
                          )}
                          <Link href={`/dashboard/subscriptions/${s.id}/edit`} className="text-xs text-gray-400 hover:text-blue-600 font-medium transition">Edit</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Billing confirmation modal */}
      {showBillingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-bold text-gray-900 text-lg mb-1">Run Monthly Billing</h2>
            <p className="text-sm text-gray-500 mb-5">
              This will create <strong>{Object.keys(dueToBill.reduce((g, s) => { if (s.clients) g[s.clients.id] = true; return g; }, {} as Record<string, boolean>)).length} draft invoice{Object.keys(dueToBill.reduce((g, s) => { if (s.clients) g[s.clients.id] = true; return g; }, {} as Record<string, boolean>)).length !== 1 ? "s" : ""}</strong> for{" "}
              <strong>{dueToBill.length} subscription{dueToBill.length !== 1 ? "s" : ""}</strong>.
              You can review and edit them before sending.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-1.5 max-h-48 overflow-y-auto">
              {dueToBill.map(s => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{s.clients?.name ?? "—"} — {s.product_name}{s.discount_percent > 0 ? ` (${s.discount_percent}% off)` : ""}</span>
                  <span className="font-semibold text-gray-900">${netRevenue(s).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBillingModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={runMonthlyBilling} disabled={billing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 transition">
                {billing ? "Creating invoices…" : "Create Draft Invoices"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
