"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  title: string | null;
  paid_at: string | null;
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
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  useEffect(() => {
    supabase
      .from("invoices")
      .select("id, invoice_number, status, due_date, subtotal, tax_rate, tax_amount, total, notes, title, paid_at, clients(name, email)")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        const inv = data as unknown as Invoice;
        setInvoice(inv);
        setSendEmail(inv?.clients?.email ?? "");
        setPaymentLink((inv as unknown as { payment_link?: string }).payment_link ?? "");
      });

    supabase
      .from("line_items")
      .select("id, description, quantity, unit_price, total")
      .eq("invoice_id", id)
      .order("sort_order")
      .then(({ data }) => setItems((data as LineItem[]) ?? []));
  }, [id]);

  async function savePaymentLink() {
    setSavingLink(true);
    await supabase.from("invoices").update({ payment_link: paymentLink || null }).eq("id", id);
    setSavingLink(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("invoices").delete().eq("id", id);
    router.push("/dashboard/invoices");
  }

  async function updateStatus(status: string) {
    const update: Record<string, unknown> = { status };
    if (status === "paid") update.paid_at = new Date().toISOString();
    await supabase.from("invoices").update(update).eq("id", id);
    setInvoice(inv => inv ? { ...inv, status, paid_at: status === "paid" ? new Date().toISOString() : inv.paid_at } : inv);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/inv/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openPublicView() {
    window.open(`${window.location.origin}/inv/${id}`, "_blank");
  }

  function printPDF() {
    window.open(`${window.location.origin}/inv/${id}?print=1`, "_blank");
  }

  async function handleSendEmail() {
    if (!invoice || !sendEmail) return;
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/send-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "invoice",
        id: invoice.id,
        number: invoice.invoice_number,
        title: invoice.title,
        clientName: invoice.clients?.name,
        clientEmail: invoice.clients?.email,
        total: invoice.total,
        toEmail: sendEmail,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setSendResult("Sent!");
      await supabase.from("invoices").update({ status: "sent" }).eq("id", id);
      setInvoice(inv => inv ? { ...inv, status: "sent" } : inv);
      setTimeout(() => { setShowEmailModal(false); setSendResult(null); }, 1500);
    } else {
      setSendResult(data.error ?? "Failed to send");
    }
    setSending(false);
  }

  if (!invoice) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex gap-2">
          <Link href={`/dashboard/invoices/${id}/edit`}
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
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{invoice.invoice_number}</p>
            <h1 className="text-xl font-semibold">{invoice.title || invoice.clients?.name || "Invoice"}</h1>
            {invoice.clients && (
              <p className="text-sm text-gray-400 mt-0.5">{invoice.clients.name}{invoice.clients.email ? ` · ${invoice.clients.email}` : ""}</p>
            )}
          </div>
          <select
            value={invoice.status}
            onChange={e => updateStatus(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm mb-6">
          <div>
            <p className="text-gray-400 mb-1">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[invoice.status]}`}>
              {invoice.status}
            </span>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Due Date</p>
            <p className="font-medium">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</p>
          </div>
          {invoice.paid_at && (
            <div>
              <p className="text-gray-400 mb-1">Paid On</p>
              <p className="font-medium">{new Date(invoice.paid_at).toLocaleDateString()}</p>
            </div>
          )}
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
              <span>Subtotal</span><span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between gap-12 text-gray-500">
                <span>Tax ({invoice.tax_rate}%)</span><span>${invoice.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between gap-12 font-bold text-base border-t pt-2">
              <span>Total</span><span>${invoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && <p className="mt-4 text-sm text-gray-500 border-t pt-4">{invoice.notes}</p>}
      </div>

      {/* Payment link */}
      <div className="bg-white rounded-xl border p-5 mb-3">
        <h2 className="font-semibold text-sm mb-3">Payment Link</h2>
        <p className="text-xs text-gray-400 mb-3">Paste a link from Stripe, PayPal, Square, or any payment processor. Clients will see a Pay Now button on their invoice.</p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://buy.stripe.com/... or paypal.me/..."
            value={paymentLink}
            onChange={e => setPaymentLink(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button type="button" onClick={savePaymentLink} disabled={savingLink}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50">
            {savingLink ? "Saving..." : "Save"}
          </button>
        </div>
        {paymentLink && (
          <a href={paymentLink} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-blue-600 hover:underline">
            Test link →
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <button
          type="button"
          onClick={copyLink}
          className="border bg-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
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
        className="w-full border bg-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
      >
        Send Email to Client
      </button>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-semibold mb-2">Delete Invoice?</h2>
            <p className="text-sm text-gray-500 mb-5">This will permanently delete the invoice and all its line items. This cannot be undone.</p>
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
            <h2 className="font-semibold mb-4">Send Invoice by Email</h2>
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
