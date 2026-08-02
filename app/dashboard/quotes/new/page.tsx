"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BLUE = "#1a3d6e";

type Client = { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null };
type LineItem = { item_name: string; description: string; quantity: string; unit_price: string };
type Company = { company_name: string | null; company_email: string | null; company_phone: string | null; company_address: string | null; company_city: string | null; company_state: string | null; company_zip: string | null; logo_url: string | null; default_notes: string | null };

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
      supabase.from("company_settings").select("company_name, company_email, company_phone, company_address, company_city, company_state, company_zip, logo_url, default_notes").limit(1).maybeSingle(),
    ]).then(([c, co]) => {
      setClients((c.data as Client[]) ?? []);
      setCompany(co.data as Company | null);
    });
  }, []);

  const selectedClient = clients.find(c => c.id === clientId) ?? null;
  const companyName = company?.company_name || "Your Company";
  const cityStateZip = [company?.company_city, company?.company_state, company?.company_zip].filter(Boolean).join(", ");

  async function handleAddClient() {
    if (!newClientName.trim()) return;
    setAddingClient(true);
    const { data } = await supabase.from("clients").insert({ name: newClientName.trim(), email: newClientEmail || null, phone: newClientPhone || null, active: true })
      .select("id, name, email, phone, address, city, state, zip").single();
    if (data) {
      const nc = data as Client;
      setClients(prev => [...prev, nc].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(nc.id);
    }
    setNewClientName(""); setNewClientEmail(""); setNewClientPhone("");
    setShowAddClient(false); setAddingClient(false);
  }

  function addItem() { setItems(p => [...p, { item_name: "", description: "", quantity: "1", unit_price: "" }]); }
  function removeItem(i: number) { setItems(p => p.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: string, value: string) {
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  const subtotal = items.reduce((s, i) => s + parseFloat(i.quantity || "0") * parseFloat(i.unit_price || "0"), 0);
  const taxAmount = subtotal * (parseFloat(taxRate || "0") / 100);
  const total = subtotal + taxAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { data: nextNum } = await supabase.rpc("next_document_number", { doc_type: "quote" });
    const quoteNumber = `QT-${String(nextNum).padStart(4, "0")}`;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: quote, error: qErr } = await supabase.from("quotes").insert({
      quote_number: quoteNumber, client_id: clientId || null, title: title || null,
      valid_until: validUntil || null, notes: notes || null,
      subtotal, tax_rate: parseFloat(taxRate || "0"), tax_amount: taxAmount, total,
      created_by: user?.id ?? null,
    }).select().single();
    if (qErr || !quote) { setError(qErr?.message ?? "Failed to create quote"); setLoading(false); return; }
    const valid = items.filter(i => (i.item_name || i.description) && i.unit_price);
    if (valid.length > 0) {
      await supabase.from("line_items").insert(valid.map((item, idx) => ({
        quote_id: quote.id, item_name: item.item_name || null,
        description: item.description || item.item_name,
        quantity: parseFloat(item.quantity), unit_price: parseFloat(item.unit_price), sort_order: idx,
      })));
    }
    router.push(`/dashboard/quotes/${quote.id}`);
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="flex h-full bg-gray-50">

      {/* ── FORM (left, scrollable) ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-8 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <div>
                <p className="text-xs text-gray-400 font-medium">Quotes</p>
                <h1 className="text-xl font-bold text-gray-900">New Quote</h1>
              </div>
            </div>
            <button type="button" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm">
              {loading ? "Creating…" : "Create Quote"}
            </button>
          </div>

          {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="space-y-6">

            {/* Client + Title */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
              <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Client & Project</h2>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Client</label>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
                    <option value="">— No client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {!showAddClient ? (
                    <button type="button" onClick={() => setShowAddClient(true)} className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add new client</button>
                  ) : (
                    <div className="mt-3 p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Quick Add Client</p>
                      <input type="text" placeholder="Company / Name *" value={newClientName} onChange={e => setNewClientName(e.target.value)} className={inputCls} />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="email" placeholder="Email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} className={inputCls} />
                        <input type="tel" placeholder="Phone" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className={inputCls} />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={handleAddClient} disabled={!newClientName.trim() || addingClient}
                          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50">{addingClient ? "Adding…" : "Add Client"}</button>
                        <button type="button" onClick={() => setShowAddClient(false)} className="border border-gray-200 rounded-lg px-4 py-2 text-xs text-gray-500 hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Project / Title</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Network Upgrade" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Valid Until</label>
                  <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Tax Rate (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-700 border-b pb-3 mb-4">Line Items</h2>

              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_120px_36px] gap-3 mb-2 px-1">
                <span className={labelCls}>Item / Description</span>
                <span className={`${labelCls} text-center`}>Qty</span>
                <span className={`${labelCls} text-right`}>Unit Price</span>
                <span />
              </div>

              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_120px_36px] gap-3 items-start">
                    {/* Item name + description stacked */}
                    <div className="space-y-1.5">
                      <input type="text" placeholder="Item name" value={item.item_name}
                        onChange={e => updateItem(i, "item_name", e.target.value)}
                        className={inputCls} />
                      <input type="text" placeholder="Description (optional)" value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        className="w-full border border-gray-100 rounded-lg px-3.5 py-2 text-xs text-gray-500 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50" />
                    </div>
                    <input type="number" placeholder="1" value={item.quantity} min="0" step="1"
                      onChange={e => updateItem(i, "quantity", e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">$</span>
                      <input type="number" placeholder="0.00" value={item.unit_price} step="0.01"
                        onChange={e => updateItem(i, "unit_price", e.target.value)}
                        className="border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
                    </div>
                    <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                      className="mt-1 text-gray-300 hover:text-red-400 transition disabled:opacity-0 text-lg font-light leading-none">×</button>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addItem}
                className="mt-4 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                Add line item
              </button>
            </div>

            {/* Notes + Totals */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <label className={labelCls}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Payment terms, special instructions…"
                  className={inputCls + " resize-none"} />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                  </div>
                  {parseFloat(taxRate) > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Tax ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-3 mt-1">
                    <span>Total</span><span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── PREVIEW (right, sticky) ── */}
      <div className="w-[400px] flex-shrink-0 border-l border-gray-200 bg-gray-100 overflow-y-auto" style={{ position: "sticky", top: 0, height: "100vh" }}>
        <div className="px-4 pt-6 pb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-4">Live Preview</p>
          <div style={{ overflow: "hidden", borderRadius: 6, boxShadow: "0 2px 16px rgba(0,0,0,0.12)" }}>
            <div style={{ width: 850, zoom: 0.47, transformOrigin: "top left", background: "white", fontFamily: "Arial, sans-serif", fontSize: 12, color: "#333" }}>

              {/* Doc Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 32px 16px" }}>
                <div>
                  {company?.logo_url
                    ? <img src={company.logo_url} alt={companyName} style={{ height: 52, maxWidth: 220, objectFit: "contain" }} />
                    : <span style={{ fontSize: 22, fontWeight: 900, color: BLUE, letterSpacing: 2 }}>{companyName.toUpperCase()}</span>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 26, fontWeight: 900, color: BLUE, letterSpacing: 3, margin: 0 }}>ESTIMATE</p>
                  <p style={{ fontSize: 10, color: "#aaa", fontStyle: "italic", margin: "2px 0 0" }}>Preview</p>
                </div>
              </div>

              {/* FROM + Info table */}
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
                      <tr><td style={{ backgroundColor: BLUE, color: "white", fontWeight: 700, padding: "3px 8px", width: 80 }}>Quote #</td><td style={{ padding: "3px 8px", borderBottom: "1px solid #e5eaf0", color: "#aaa", fontStyle: "italic" }}>Draft</td></tr>
                      <tr><td style={{ backgroundColor: "#e8edf4", fontWeight: 600, padding: "3px 8px", borderBottom: "1px solid #c8d5e4" }}>Date</td><td style={{ padding: "3px 8px", borderBottom: "1px solid #e5eaf0" }}>{new Date().toLocaleDateString()}</td></tr>
                      {validUntil && <tr><td style={{ backgroundColor: "#e8edf4", fontWeight: 600, padding: "3px 8px", borderBottom: "1px solid #c8d5e4" }}>Valid Until</td><td style={{ padding: "3px 8px" }}>{new Date(validUntil + "T12:00:00").toLocaleDateString()}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PREPARED FOR */}
              <div style={{ padding: "0 32px 16px" }}>
                <div style={{ backgroundColor: BLUE, color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", marginBottom: 4 }}>PREPARED FOR</div>
                {selectedClient ? <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{selectedClient.name}</p> : <p style={{ color: "#ccc", fontSize: 11, margin: 0, fontStyle: "italic" }}>No client selected</p>}
                {title && <p style={{ fontWeight: 600, color: "#333", margin: "4px 0 0" }}>{title}</p>}
              </div>

              {/* Line Items */}
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
                      <tr><td colSpan={5} style={{ textAlign: "center", padding: "20px 8px", color: "#ddd", fontStyle: "italic" }}>Add line items on the left</td></tr>
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
                  {(notes || company?.default_notes) && <>
                    <div style={{ backgroundColor: BLUE, color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", marginBottom: 4 }}>Notes / Terms</div>
                    {notes && <p style={{ fontSize: 10, color: "#444", margin: "0 0 2px" }}>{notes}</p>}
                    {company?.default_notes && <p style={{ fontSize: 10, color: "#666", margin: 0 }}>{company.default_notes}</p>}
                  </>}
                </div>
                <div style={{ width: 210 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e5eaf0" }}><td style={{ backgroundColor: "#e8edf4", fontWeight: 600, padding: "4px 8px" }}>Subtotal</td><td style={{ padding: "4px 8px", textAlign: "right" }}>${subtotal.toFixed(2)}</td></tr>
                      {parseFloat(taxRate) > 0 && <tr style={{ borderBottom: "1px solid #e5eaf0" }}><td style={{ backgroundColor: "#e8edf4", fontWeight: 600, padding: "4px 8px" }}>Tax ({taxRate}%)</td><td style={{ padding: "4px 8px", textAlign: "right" }}>${taxAmount.toFixed(2)}</td></tr>}
                      <tr><td style={{ backgroundColor: BLUE, color: "white", fontWeight: 700, fontSize: 13, padding: "5px 8px" }}>TOTAL</td><td style={{ backgroundColor: BLUE, color: "white", fontWeight: 700, fontSize: 13, padding: "5px 8px", textAlign: "right" }}>${total.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
