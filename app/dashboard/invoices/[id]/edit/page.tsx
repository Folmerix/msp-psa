"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = { id: string; name: string };
type LineItem = { item_name: string; description: string; quantity: string; unit_price: string };

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ item_name: "", description: "", quantity: "1", unit_price: "" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("clients").select("id, name").eq("active", true).order("name"),
      supabase.from("invoices").select("client_id, title, due_date, tax_rate, notes").eq("id", id).single(),
      supabase.from("line_items").select("item_name, description, quantity, unit_price").eq("invoice_id", id).order("sort_order"),
    ]).then(([clientsRes, invoiceRes, itemsRes]) => {
      setClients((clientsRes.data as Client[]) ?? []);
      if (invoiceRes.data) {
        const inv = invoiceRes.data;
        setClientId(inv.client_id ?? "");
        setTitle(inv.title ?? "");
        setDueDate(inv.due_date ?? "");
        setTaxRate(String(inv.tax_rate ?? 0));
        setNotes(inv.notes ?? "");
      }
      if (itemsRes.data && itemsRes.data.length > 0) {
        setItems(itemsRes.data.map(i => ({
          item_name: i.item_name ?? "",
          description: i.description ?? "",
          quantity: String(i.quantity),
          unit_price: String(i.unit_price),
        })));
      }
      setLoading(false);
    });
  }, [id]);

  function addItem() {
    setItems([...items, { item_name: "", description: "", quantity: "1", unit_price: "" }]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: string, value: string) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  const subtotal = items.reduce((sum, item) =>
    sum + (parseFloat(item.quantity || "0") * parseFloat(item.unit_price || "0")), 0);
  const taxAmount = subtotal * (parseFloat(taxRate || "0") / 100);
  const total = subtotal + taxAmount;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { error: updateError } = await supabase.from("invoices").update({
      client_id: clientId || null,
      title: title || null,
      due_date: dueDate || null,
      notes: notes || null,
      subtotal,
      tax_rate: parseFloat(taxRate || "0"),
      tax_amount: taxAmount,
      total,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await supabase.from("line_items").delete().eq("invoice_id", id);
    const validItems = items.filter(i => (i.item_name || i.description) && i.unit_price);
    if (validItems.length > 0) {
      await supabase.from("line_items").insert(
        validItems.map((item, idx) => ({
          invoice_id: id,
          item_name: item.item_name || null,
          description: item.description || item.item_name,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          sort_order: idx,
        }))
      );
    }

    router.push(`/dashboard/invoices/${id}`);
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-xl font-semibold">Edit Invoice</h1>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black">
              <option value="">— No client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Monthly IT Support - August"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-3">Line Items</h2>
          <div className="space-y-3 mb-3">
            <div className="grid grid-cols-[1fr_1fr_64px_96px_32px] gap-2 text-xs font-medium text-gray-400 px-1">
              <span>Item</span><span>Description</span><span className="text-center">Qty</span><span className="text-center">Price</span><span />
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_64px_96px_32px] gap-2 items-start">
                <input type="text" placeholder="Item name" value={item.item_name}
                  onChange={e => updateItem(i, "item_name", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                <input type="text" placeholder="Details (optional)" value={item.description}
                  onChange={e => updateItem(i, "description", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                <input type="number" placeholder="1" value={item.quantity} min="0" step="0.01"
                  onChange={e => updateItem(i, "quantity", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black text-center" />
                <input type="number" placeholder="0.00" value={item.unit_price} step="0.01"
                  onChange={e => updateItem(i, "unit_price", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none disabled:opacity-0 pt-2">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="text-sm text-gray-500 hover:text-black">+ Add line</button>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="space-y-1 text-sm text-right">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {parseFloat(taxRate) > 0 && (
              <div className="flex justify-between text-gray-500"><span>Tax ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
