"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Invoice = {
  id: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  total: number;
  notes: string | null;
  stripe_payment_link: string | null;
  clients: { name: string; email: string | null } | null;
};

type InvoiceItem = {
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
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [paymentLink, setPaymentLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  useEffect(() => {
    supabase
      .from("invoices")
      .select("id, status, issue_date, due_date, total, notes, stripe_payment_link, clients(name, email)")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setInvoice(data as unknown as Invoice);
        setPaymentLink(data?.stripe_payment_link ?? "");
      });

    supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_price, total")
      .eq("invoice_id", id)
      .then(({ data }) => setItems((data as InvoiceItem[]) ?? []));
  }, [id]);

  async function updateStatus(status: string) {
    await supabase.from("invoices").update({ status }).eq("id", id);
    setInvoice(inv => inv ? { ...inv, status } : inv);
  }

  async function savePaymentLink() {
    setSavingLink(true);
    await supabase.from("invoices").update({ stripe_payment_link: paymentLink || null }).eq("id", id);
    setInvoice(inv => inv ? { ...inv, stripe_payment_link: paymentLink } : inv);
    setSavingLink(false);
  }

  if (!invoice) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm mb-4 block">← Back</button>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">{invoice.clients?.name ?? "—"}</h1>
            {invoice.clients?.email && <p className="text-sm text-gray-400">{invoice.clients.email}</p>}
          </div>
          <select
            value={invoice.status}
            onChange={e => updateStatus(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm mb-6">
          <div>
            <p className="text-gray-400">Status</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[invoice.status]}`}>
              {invoice.status}
            </span>
          </div>
          <div>
            <p className="text-gray-400">Issue Date</p>
            <p className="font-medium">{new Date(invoice.issue_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-400">Due Date</p>
            <p className="font-medium">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</p>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm mb-6">
          <thead className="border-b">
            <tr>
              <th className="text-left py-2 font-medium text-gray-600">Description</th>
              <th className="text-right py-2 font-medium text-gray-600">Qty</th>
              <th className="text-right py-2 font-medium text-gray-600">Unit Price</th>
              <th className="text-right py-2 font-medium text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
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
          <div className="text-right">
            <p className="text-sm text-gray-400">Total</p>
            <p className="text-2xl font-bold">${(invoice.total ?? 0).toFixed(2)}</p>
          </div>
        </div>

        {invoice.notes && (
          <p className="mt-4 text-sm text-gray-500 border-t pt-4">{invoice.notes}</p>
        )}
      </div>

      {/* Stripe payment link */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-3">Payment Link</h2>
        <p className="text-sm text-gray-500 mb-3">
          Generate a payment link in your Stripe dashboard and paste it here. Share it with your client to collect payment.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://buy.stripe.com/..."
            value={paymentLink}
            onChange={e => setPaymentLink(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            type="button"
            onClick={savePaymentLink}
            disabled={savingLink}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {savingLink ? "Saving..." : "Save"}
          </button>
        </div>
        {invoice.stripe_payment_link && (
          <a
            href={invoice.stripe_payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline"
          >
            Open payment link →
          </a>
        )}
      </div>
    </div>
  );
}
