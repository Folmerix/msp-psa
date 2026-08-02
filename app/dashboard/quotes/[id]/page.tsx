"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Quote = {
  id: string;
  quote_number: string;
  status: string;
  valid_until: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  title: string | null;
  client_id: string | null;
  clients: { name: string; email: string | null } | null;
};

type LineItem = {
  id: string;
  item_name: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-yellow-100 text-yellow-700",
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [converting, setConverting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    supabase
      .from("quotes")
      .select("id, quote_number, status, valid_until, subtotal, tax_rate, tax_amount, total, notes, title, client_id, clients(name, email)")
      .eq("id", id).single()
      .then(({ data }) => {
        const q = data as unknown as Quote;
        setQuote(q);
        setSendEmail(q?.clients?.email ?? "");
      });
    supabase.from("line_items").select("id, item_name, description, quantity, unit_price, total").eq("quote_id", id).order("sort_order")
      .then(({ data }) => setItems((data as LineItem[]) ?? []));
  }, [id]);

  async function updateStatus(status: string) {
    await supabase.from("quotes").update({ status }).eq("id", id);
    setQuote(q => q ? { ...q, status } : q);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/q/${id}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendEmail() {
    if (!quote || !sendEmail) return;
    setSending(true); setSendResult(null);
    const res = await fetch("/api/send-document", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quote", id: quote.id, number: quote.quote_number, title: quote.title, clientName: quote.clients?.name, clientEmail: quote.clients?.email, total: quote.total, toEmail: sendEmail }),
    });
    const data = await res.json();
    if (data.ok) {
      setSendResult("Sent!");
      await supabase.from("quotes").update({ status: "sent" }).eq("id", id);
      setQuote(q => q ? { ...q, status: "sent" } : q);
      setTimeout(() => { setShowEmailModal(false); setSendResult(null); }, 1500);
    } else { setSendResult(data.error ?? "Failed to send"); }
    setSending(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("quotes").delete().eq("id", id);
    router.push("/dashboard/quotes");
  }

  async function convertToInvoice() {
    if (!quote) return;
    setConverting(true);
    const { data: nextNum } = await supabase.rpc("next_document_number", { doc_type: "invoice" });
    const invoiceNumber = `INV-${String(nextNum).padStart(4, "0")}`;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: invoice, error } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber, client_id: quote.client_id, quote_id: quote.id,
      title: quote.title, notes: quote.notes, subtotal: quote.subtotal,
      tax_rate: quote.tax_rate, tax_amount: quote.tax_amount, total: quote.total, created_by: user?.id ?? null,
    }).select().single();
    if (error || !invoice) { setConverting(false); return; }
    if (items.length > 0) {
      await supabase.from("line_items").insert(items.map((item, idx) => ({
        invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, sort_order: idx,
      })));
    }
    await supabase.from("quotes").update({ status: "accepted" }).eq("id", id);
    router.push(`/dashboard/invoices/${invoice.id}`);
  }

  if (!quote) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Quotes</p>
            <h1 className="text-xl font-bold text-gray-900">{quote.title || quote.clients?.name || "Quote"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/quotes/${id}/edit`} className="border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition">
            Edit
          </Link>
          <button type="button" onClick={() => setShowDeleteConfirm(true)} className="border border-red-200 text-red-500 bg-white hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg transition">
            Delete
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-6 p-8 pt-6 flex-1 min-h-0 overflow-y-auto">

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Quote info card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{quote.quote_number}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[quote.status]}`}>{quote.status}</span>
              {quote.clients && <span className="text-sm text-gray-500">{quote.clients.name}{quote.clients.email ? ` · ${quote.clients.email}` : ""}</span>}
            </div>
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Valid Until</p>
                <p className="font-medium text-gray-900">{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Tax Rate</p>
                <p className="font-medium text-gray-900">{quote.tax_rate > 0 ? `${quote.tax_rate}%` : "None"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Client</p>
                <p className="font-medium text-gray-900">{quote.clients?.name || "—"}</p>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">Line Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Qty</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Unit Price</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">No line items</td></tr>
                )}
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{item.item_name || item.description}</p>
                      {item.item_name && item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-6 py-4 text-right text-gray-600">${item.unit_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-700 mb-2">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4">

          {/* Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Status</p>
            <select value={quote.status} onChange={e => updateStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Totals</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>${quote.subtotal.toFixed(2)}</span>
              </div>
              {quote.tax_rate > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Tax ({quote.tax_rate}%)</span><span>${quote.tax_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100 text-gray-900">
                <span>Total</span><span>${quote.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</p>
            <button type="button" onClick={copyLink}
              className="w-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition">
              {copied ? "✓ Copied!" : "Copy Client Link"}
            </button>
            <button type="button" onClick={() => window.open(`${window.location.origin}/q/${id}`, "_blank")}
              className="w-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition">
              Preview Document
            </button>
            <button type="button" onClick={() => window.open(`${window.location.origin}/q/${id}?print=1`, "_blank")}
              className="w-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition">
              Print / PDF
            </button>
            <button type="button" onClick={() => setShowEmailModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition">
              Send Email to Client
            </button>
            {quote.status === "accepted" && (
              <button type="button" onClick={convertToInvoice} disabled={converting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition">
                {converting ? "Creating Invoice…" : "Convert to Invoice"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-semibold mb-2">Delete Quote?</h2>
            <p className="text-sm text-gray-500 mb-5">This permanently deletes the quote and all line items. Cannot be undone.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-semibold mb-4">Send Quote by Email</h2>
            <label className="block text-sm font-medium mb-1">Recipient email</label>
            <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="client@company.com" />
            {sendResult && <p className={`text-sm mb-3 ${sendResult === "Sent!" ? "text-green-600" : "text-red-600"}`}>{sendResult}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowEmailModal(false); setSendResult(null); }} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleSendEmail} disabled={sending || !sendEmail}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
