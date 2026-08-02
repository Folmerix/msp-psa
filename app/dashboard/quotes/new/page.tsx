"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BLUE = "#1a3d6e";

type Client = { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null };
type LineItem = { item_name: string; description: string; quantity: string; unit_price: string };
type Company = { company_name: string | null; company_email: string | null; company_phone: string | null; company_address: string | null; company_city: string | null; company_state: string | null; company_zip: string | null; logo_url: string | null; payment_terms: string | null; default_notes: string | null };

export default function NewQuotePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ item_name: "", description: "", quantity: "1", unit_price: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [addingClient, setAddingClient] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("clients").select("id, name, email, phone, address, city, state, zip").eq("active", true).order("name"),
      supabase.from("company_settings").select("company_name, company_email, company_phone, company_address, company_city, company_state, company_zip, logo_url, payment_terms, default_notes").limit(1).maybeSingle(),
    ]).then(([clientsRes, companyRes]) => {
      setClients((clientsRes.data as Client[]) ?? []);
      setCompany(companyRes.data as Company | null);
    });
  }, []);

  const selectedClient = clients.find(c => c.id === clientId) ?? null;

  async function handleAddClient() {
    if (!newClientName.trim()) return;
    setAddingClient(true);
    const { data } = await supabase.from("clients").insert({
      name: newClientName.trim(),
      email: newClientEmail || null,
      phone: newClientPhone || null,
      active: true,
    }).select("id, name, email, phone, address, city, state, zip").single();
    if (data) {
      const newClient = data as Client;
      setClients(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(newClient.id);
    }
    setNewClientName(""); setNewClientEmail(""); setNewClientPhone("");
    setShowAddClient(false);
    setAddingClient(false);
  }

  function addItem() { setItems([...items, { item_name: "", description: "", quantity: "1", unit_price: "" }]); }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: string, value: string) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  const subtotal = items.reduce((sum, item) =>
    sum + (parseFloat(item.quantity || "0") * parseFloat(item.unit_price || "0")), 0);
  const taxAmount = subtotal * (parseFloat(taxRate || "0") / 100);
  const total = subtotal + taxAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data: nextNum } = await supabase.rpc("next_document_number", { doc_type: "quote" });
    const quoteNumber = `QT-${String(nextNum).padStart(4, "0")}`;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: quote, error: quoteError } = await supabase.from("quotes").insert({
      quote_number: quoteNumber,
      client_id: clientId || null,
      title: title || null,
      valid_until: validUntil || null,
      notes: notes || null,
      subtotal, tax_rate: parseFloat(taxRate || "0"), tax_amount: taxAmount, total,
      created_by: user?.id ?? null,
    }).select().single();
    if (quoteError || !quote) { setError(quoteError?.message ?? "Failed to create quote"); setLoading(false); return; }
    const validItems = items.filter(i => (i.item_name || i.description) && i.unit_price);
    if (validItems.length > 0) {
      await supabase.from("line_items").insert(
        validItems.map((item, idx) => ({
          quote_id: quote.id,
          item_name: item.item_name || null,
          description: item.description || item.item_name,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          sort_order: idx,
        }))
      );
    }
    router.push(`/dashboard/quotes/${quote.id}`);
  }

  const companyName = company?.company_name || "Your Company";
  const cityStateZip = [company?.company_city, company?.company_state, company?.company_zip].filter(Boolean).join(", ");

  return (
    <div className="flex items-start">
      {/* ── LEFT: Form ── */}
      <div className="w-[420px] flex-shrink-0 border-r bg-gray-50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
            <h1 className="text-xl font-semibold">New Quote</h1>
          </div>

          {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-white rounded-xl border p-6 space-y-4">
              {/* Client */}
              <div>
                <label className="block text-sm font-medium mb-1">Client</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black">
                  <option value="">— No client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!showAddClient ? (
                  <button type="button" onClick={() => setShowAddClient(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1.5">+ Add new client</button>
                ) : (
                  <div className="mt-3 p-3 bg-gray-50 border rounded-lg space-y-2">
                    <p className="text-xs font-semibold text-gray-600">Quick Add Client</p>
                    <input type="text" placeholder="Name *" value={newClientName} onChange={e => setNewClientName(e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="email" placeholder="Email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)}
                        className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                      <input type="tel" placeholder="Phone" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)}
                        className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleAddClient} disabled={!newClientName.trim() || addingClient}
                        className="bg-black text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                        {addingClient ? "Adding..." : "Add Client"}
                      </button>
                      <button type="button" onClick={() => setShowAddClient(false)}
                        className="border rounded-md px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100">Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Title / Project</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Network Upgrade Proposal"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Valid Until</label>
                  <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
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

            {/* Line Items */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold mb-3">Line Items</h2>
              <div className="space-y-2 mb-3">
                <div className="grid grid-cols-[1fr_1fr_56px_88px_28px] gap-2 text-xs font-medium text-gray-400">
                  <span>Item</span><span>Description</span><span className="text-center">Qty</span><span className="text-center">Price ($)</span><span />
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_56px_88px_28px] gap-2 items-center">
                    <input type="text" placeholder="Item name" value={item.item_name}
                      onChange={e => updateItem(i, "item_name", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    <input type="text" placeholder="Details" value={item.description}
                      onChange={e => updateItem(i, "description", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    <input type="number" placeholder="1" value={item.quantity} min="0" step="1"
                      onChange={e => updateItem(i, "quantity", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black text-center" />
                    <input type="number" placeholder="0.00" value={item.unit_price} step="0.01"
                      onChange={e => updateItem(i, "unit_price", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                    <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                      className="text-gray-300 hover:text-red-400 text-base disabled:opacity-0">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} className="text-sm text-gray-500 hover:text-black">+ Add line</button>
            </div>

            {/* Totals */}
            <div className="bg-white rounded-xl border p-5 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {parseFloat(taxRate) > 0 && (
                <div className="flex justify-between text-gray-500 mt-1"><span>Tax ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Creating..." : "Create Quote"}
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: Live Preview ── */}
      <div className="flex-1 bg-gray-300 p-6" style={{ position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <p className="text-xs text-gray-500 text-center mb-4 font-semibold uppercase tracking-wider">Live Preview</p>
        <div style={{ maxWidth: 510, margin: "0 auto", overflowX: "hidden" }}>
        <div style={{ width: 850, zoom: 0.6, background: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.15)", borderRadius: 8, overflow: "hidden", fontFamily: "Arial, sans-serif", fontSize: 12, color: "#333" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 32px 16px" }}>
            <div>
              {company?.logo_url
                ? <img src={company.logo_url} alt={companyName} style={{ height: 52, maxWidth: 220, objectFit: "contain" }} />
                : <span style={{ fontSize: 22, fontWeight: 900, color: BLUE, letterSpacing: 2 }}>{companyName.toUpperCase()}</span>
              }
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 26, fontWeight: 900, color: BLUE, letterSpacing: 3, margin: 0 }}>ESTIMATE</p>
              <p style={{ fontSize: 10, color: "#999", fontStyle: "italic", margin: "2px 0 0" }}>Preview — not saved yet</p>
            </div>
          </div>

          {/* FROM + Quote Info */}
          <div style={{ display: "flex", gap: 24, padding: "0 32px 16px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ backgroundColor: BLUE, color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", marginBottom: 4 }}>FROM</div>
              <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 2px" }}>{companyName}</p>
              {company?.company_address && <p style={{ margin: "1px 0", color: "#555" }}>{company.company_address}</p>}
              {cityStateZip && <p style={{ margin: "1px 0", color: "#555" }}>{cityStateZip}</p>}
              {company?.company_phone && <p style={{ margin: "1px 0", color: "#555" }}>{company.company_phone}</p>}
              {company?.company_email && <p style={{ margin: "1px 0", color: BLUE }}>{company.company_email}</p>}
            </div>
            <div style={{ width: 220 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid #c8d5e4`, fontSize: 11 }}>
                <tbody>
                  <tr>
                    <td style={{ backgroundColor: BLUE, color: "white", fontWeight: 700, padding: "3px 8px", width: 80 }}>Quote #</td>
                    <td style={{ padding: "3px 8px", borderBottom: "1px solid #e5eaf0", fontStyle: "italic", color: "#999" }}>Draft</td>
                  </tr>
                  <tr>
                    <td style={{ backgroundColor: "#e8edf4", fontWeight: 600, padding: "3px 8px", borderBottom: "1px solid #c8d5e4" }}>Date</td>
                    <td style={{ padding: "3px 8px", borderBottom: "1px solid #e5eaf0" }}>{new Date().toLocaleDateString()}</td>
                  </tr>
                  {validUntil && (
                    <tr>
                      <td style={{ backgroundColor: "#e8edf4", fontWeight: 600, padding: "3px 8px", borderBottom: "1px solid #c8d5e4" }}>Valid Until</td>
                      <td style={{ padding: "3px 8px", borderBottom: "1px solid #e5eaf0" }}>{new Date(validUntil + "T12:00:00").toLocaleDateString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PREPARED FOR */}
          <div style={{ padding: "0 32px 16px" }}>
            <div style={{ backgroundColor: BLUE, color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", marginBottom: 4 }}>PREPARED FOR</div>
            {selectedClient
              ? <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{selectedClient.name}</p>
              : <p style={{ color: "#bbb", fontSize: 11, margin: 0, fontStyle: "italic" }}>No client selected</p>
            }
            {title && <p style={{ fontWeight: 600, color: "#333", margin: "4px 0 0" }}>{title}</p>}
          </div>

          {/* Line Items Table */}
          <div style={{ padding: "0 32px 16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ backgroundColor: BLUE, color: "white" }}>
                  <th style={{ textAlign: "left", padding: "5px 8px", width: "22%" }}>Item</th>
                  <th style={{ textAlign: "left", padding: "5px 8px" }}>Description</th>
                  <th style={{ textAlign: "center", padding: "5px 8px", width: "6%" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "5px 8px", width: "13%" }}>Unit Price</th>
                  <th style={{ textAlign: "right", padding: "5px 8px", width: "13%" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(i => i.item_name || i.description).length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "16px 8px", color: "#ccc", fontStyle: "italic" }}>Add line items on the left</td></tr>
                ) : items.filter(i => i.item_name || i.description).map((item, i) => {
                  const qty = parseFloat(item.quantity || "0");
                  const price = parseFloat(item.unit_price || "0");
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #e5eaf0", backgroundColor: i % 2 === 0 ? "white" : "#f7f9fc" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: BLUE, verticalAlign: "top" }}>{item.item_name || item.description}</td>
                      <td style={{ padding: "6px 8px", color: "#555", verticalAlign: "top" }}>{item.item_name ? item.description : ""}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center", verticalAlign: "top" }}>{item.quantity}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", verticalAlign: "top" }}>${price.toFixed(2)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", verticalAlign: "top" }}>${(qty * price).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notes + Totals */}
          <div style={{ display: "flex", gap: 24, padding: "0 32px 28px" }}>
            <div style={{ flex: 1 }}>
              {(notes || company?.default_notes) && (
                <>
                  <div style={{ backgroundColor: BLUE, color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", marginBottom: 4 }}>Notes / Terms</div>
                  {notes && <p style={{ fontSize: 10, color: "#444", margin: "0 0 2px" }}>{notes}</p>}
                  {company?.default_notes && <p style={{ fontSize: 10, color: "#666", margin: 0 }}>{company.default_notes}</p>}
                </>
              )}
            </div>
            <div style={{ width: 210 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e5eaf0" }}>
                    <td style={{ backgroundColor: "#e8edf4", fontWeight: 600, padding: "4px 8px" }}>Subtotal</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>${subtotal.toFixed(2)}</td>
                  </tr>
                  {parseFloat(taxRate) > 0 && (
                    <tr style={{ borderBottom: "1px solid #e5eaf0" }}>
                      <td style={{ backgroundColor: "#e8edf4", fontWeight: 600, padding: "4px 8px" }}>Tax ({taxRate}%)</td>
                      <td style={{ padding: "4px 8px", textAlign: "right" }}>${taxAmount.toFixed(2)}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ backgroundColor: BLUE, color: "white", fontWeight: 700, fontSize: 13, padding: "5px 8px" }}>TOTAL</td>
                    <td style={{ backgroundColor: BLUE, color: "white", fontWeight: 700, fontSize: 13, padding: "5px 8px", textAlign: "right" }}>${total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
