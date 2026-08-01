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
      .eq("id", id)
      .single()
      .then(({ data }) => {
        const q = data as unknown as Quote;
        setQuote(q);
        setSendEmail(q?.clients?.email ?? "");
      });

    supabase
      .from("line_items")
      .select("id, description, quantity, unit_price, total")
      .eq("quote_id", id)
      .order("sort_order")
      .then(({ data }) => setItems((data as LineItem[]) ?? []));
  }, [id]);

  async function updateStatus(status: string) {
    await supabase.from("quotes").update({ status }).eq("id", id);
    setQuote(q => q ? { ...q, status } : q);
  }

  function copyLink() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    navigator.clipboard.writeText(`${appUrl}/q/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openPublicView() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    window.open(`${appUrl}/q/${id}`, "_blank");
  }

  function printPDF() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    window.open(`${appUrl}/q/${id}?print=1`, "_blank");
  }

  async function handleSendEmail() {
    if (!quote || !sendEmail) return;
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/send-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "quote",
        id: quote.id,
        number: quote.quote_number,
        title: quote.title,
        clientName: quote.clients?.name,
        clientEmail: quote.clients?.email,
        total: quote.total,
        toEmail: sendEmail,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setSendResult("Sent!");
      await supabase.from("quotes").update({ status: "sent" }).eq("id", id);
      setQuote(q => q ? { ...q, status: "sent" } : q);
      setTimeout(() => { setShowEmailModal(false); setSendResult(null); }, 1500);
    } else {
      setSendResult(data.error ?? "Failed to send");
    }
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

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        client_id: quote.client_id,
        quote_id: quote.id,
        title: quote.title,
        notes: quote.notes,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate,
        tax_amount: quote.tax_amount,
        total: quote.total,
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error || !invoice) { setConverting(false); return; }

    if (items.length > 0) {
      await supabase.from("line_items").insert(
        items.map((item, idx) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          sort_order: idx,
        }))
      );
    }

    await supabase.from("quotes").update({ status: "accepted" }).eq("id", id);
    router.push(`/dashboard/invoices/${invoice.id}`);
  }

  if (!quote) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex gap-2">
          <Link href={`/dashboard/quotes/${id}/edit`}
            className="border bg-white rounded-lg px-4 py-1.5 text-sm hover:bg-gray-50">
            Edit
          </Link>
          <button type="button" onClick={() => setShowDeleteConfirm(true)}
            className="border border-red-200 text-red-500 bg-white rounded-lg px-4 py-1.5 text-sm hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-5">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{quote.quote_number}</p>
            <h1 className="text-xl font-semibold">{quote.title || quote.clients?.name || "Quote"}</h1>
            {quote.clients && (
              <p className="text-sm text-gray-400 mt-0.5">{quote.clients.name}{quote.clients.email ? ` · ${quote.clients.email}` : ""}</p>
            )}
          </div>
          <select
            value={quote.status}
            onChange={e => updateStatus(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm mb-6">
          <div>
            <p className="text-gray-400 mb-1">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[quote.status]}`}>
              {quote.status}
            </span>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Valid Until</p>
            <p className="font-medium">{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : "—"}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead className="border-b">
            <tr>
              <th className="text-left py-2 font-medium text-gray-500">Description</th>
              <th className="text-right py-2 font-medium text-gray-500">Qty</th>
              <th className="text-right py-2 font-medium text-gray-500">Unit Price</th>
              <th className="text-right py-2 font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-gray-400">No line items</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id}>
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right text-gray-500">{item.quantity}</td>
                <td className="py-2 text-right text-gray-500">${item.unit_price.toFixed(2)}</td>
                <td className="py-2 text-right font-medium">${item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end border-t pt-4">
          <div className="text-right text-sm space-y-1">
            <div className="flex justify-between gap-12 text-gray-500">
              <span>Subtotal</span><span>${quote.subtotal.toFixed(2)}</span>
            </div>
            {quote.tax_rate > 0 && (
              <div className="flex justify-between gap-12 text-gray-500">
                <span>Tax ({quote.tax_rate}%)</span><span>${quote.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between gap-12 font-bold text-base border-t pt-2">
              <span>Total</span><span>${quote.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {quote.notes && <p className="mt-4 text-sm text-gray-500 border-t pt-4">{quote.notes}</p>}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <button
          type="button"
          onClick={copyLink}
          className="border bg-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          {copied ? "✓ Copied!" : "Copy Link"}
        </button>
        <button
          type="button"
          onClick={openPublicView}
          className="border bg-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={printPDF}
          className="border bg-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
        >
          Print / PDF
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowEmailModal(true)}
        className="w-full border bg-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 mb-3"
      >
        Send Email to Client
      </button>

      {quote.status === "accepted" && (
        <button
          type="button"
          onClick={convertToInvoice}
          disabled={converting}
          className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {converting ? "Creating invoice..." : "Convert to Invoice"}
        </button>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-semibold mb-2">Delete Quote?</h2>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete the quote and all its line items. This cannot be undone.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete"}
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
            <input
              type="email"
              value={sendEmail}
              onChange={e => setSendEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="client@company.com"
            />
            {sendResult && (
              <p className={`text-sm mb-3 ${sendResult === "Sent!" ? "text-green-600" : "text-red-600"}`}>{sendResult}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowEmailModal(false); setSendResult(null); }}
                className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sending || !sendEmail}
                className="flex-1 bg-black text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
