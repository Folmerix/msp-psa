"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = { id: string; name: string };
type TimeEntry = { id: string; minutes: number; notes: string | null; tickets: { title: string } | null };

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [billableTime, setBillableTime] = useState<TimeEntry[]>([]);
  const [hourlyRate, setHourlyRate] = useState("0");
  const [items, setItems] = useState<{ description: string; quantity: string; unit_price: string }[]>([
    { description: "", quantity: "1", unit_price: "" },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("id, name").eq("active", true).order("name").then(({ data }) => {
      setClients((data as Client[]) ?? []);
    });
  }, []);

  useEffect(() => {
    if (!clientId) { setBillableTime([]); return; }
    supabase
      .from("time_entries")
      .select("id, minutes, notes, tickets!inner(title, client_id)")
      .eq("billable", true)
      .eq("tickets.client_id", clientId)
      .then(({ data }) => {
        setBillableTime((data as unknown as TimeEntry[]) ?? []);
      });
  }, [clientId]);

  function addItem() {
    setItems([...items, { description: "", quantity: "1", unit_price: "" }]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: string, value: string) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  const timeTotal = billableTime.reduce((sum, e) => sum + e.minutes, 0) / 60 * parseFloat(hourlyRate || "0");
  const itemsTotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity || "0") * parseFloat(item.unit_price || "0"));
  }, 0);
  const grandTotal = timeTotal + itemsTotal;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        client_id: clientId,
        issue_date: issueDate,
        due_date: dueDate || null,
        notes: notes || null,
        total: grandTotal,
      })
      .select()
      .single();

    if (error || !invoice) { setLoading(false); return; }

    const lineItems = [];

    // Time entries as a single line item
    if (billableTime.length > 0 && parseFloat(hourlyRate) > 0) {
      const hours = billableTime.reduce((sum, e) => sum + e.minutes, 0) / 60;
      lineItems.push({
        invoice_id: invoice.id,
        description: `Labor (${hours.toFixed(2)} hrs @ $${hourlyRate}/hr)`,
        quantity: parseFloat(hours.toFixed(2)),
        unit_price: parseFloat(hourlyRate),
      });
    }

    // Manual line items
    for (const item of items) {
      if (item.description && item.unit_price) {
        lineItems.push({
          invoice_id: invoice.id,
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
        });
      }
    }

    if (lineItems.length > 0) {
      await supabase.from("invoice_items").insert(lineItems);
    }

    router.push(`/dashboard/invoices/${invoice.id}`);
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-xl font-semibold">New Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <label htmlFor="client" className="block text-sm font-medium mb-1">Client *</label>
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="issueDate" className="block text-sm font-medium mb-1">Issue Date</label>
              <input id="issueDate" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium mb-1">Due Date</label>
              <input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes</label>
            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
          </div>
        </div>

        {/* Billable time */}
        {clientId && billableTime.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold mb-3">Billable Time</h2>
            <div className="text-sm text-gray-500 mb-3">
              {billableTime.reduce((s, e) => s + e.minutes, 0) / 60 === 0 ? "0" : (billableTime.reduce((s, e) => s + e.minutes, 0) / 60).toFixed(2)} hrs across {billableTime.length} entries
            </div>
            <div>
              <label htmlFor="hourlyRate" className="block text-sm font-medium mb-1">Hourly Rate ($)</label>
              <input id="hourlyRate" type="number" min="0" step="0.01" value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                className="w-32 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          </div>
        )}

        {/* Line items */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-3">Line Items</h2>
          <div className="space-y-2 mb-3">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={e => updateItem(i, "description", e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  min="0"
                  step="0.01"
                  onChange={e => updateItem(i, "quantity", e.target.value)}
                  className="w-16 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={item.unit_price}
                  min="0"
                  step="0.01"
                  onChange={e => updateItem(i, "unit_price", e.target.value)}
                  className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 text-sm px-2 py-2">✕</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="text-sm text-gray-500 hover:text-black">+ Add line item</button>
        </div>

        {/* Total */}
        <div className="bg-white rounded-xl border p-6 flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-bold">${grandTotal.toFixed(2)}</span>
        </div>

        <button
          type="submit"
          disabled={loading || !clientId}
          className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Invoice"}
        </button>
      </form>
    </div>
  );
}
