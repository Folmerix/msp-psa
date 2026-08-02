"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
  created_at: string;
  clients: {
    name: string; email: string | null; phone: string | null;
    address: string | null; city: string | null; state: string | null; zip: string | null;
  } | null;
};

type LineItem = {
  id: string; item_name: string | null; description: string;
  quantity: number; unit_price: number; total: number;
};

type Company = {
  company_name: string | null; company_email: string | null; company_phone: string | null;
  company_address: string | null; company_city: string | null; company_state: string | null;
  company_zip: string | null; logo_url: string | null; payment_terms: string | null; default_notes: string | null;
  primary_color: string | null; secondary_color: string | null; accent_color: string | null;
};

export default function PublicQuotePage() {
  return <Suspense><PublicQuoteContent /></Suspense>;
}

function PublicQuoteContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("quotes").select("id, quote_number, status, valid_until, subtotal, tax_rate, tax_amount, total, notes, title, created_at, clients(name, email, phone, address, city, state, zip)").eq("id", id).single(),
      supabase.from("line_items").select("id, item_name, description, quantity, unit_price, total").eq("quote_id", id).order("sort_order"),
      supabase.from("company_settings").select("company_name, company_email, company_phone, company_address, company_city, company_state, company_zip, logo_url, payment_terms, default_notes, primary_color, secondary_color, accent_color").limit(1).maybeSingle(),
    ]).then(([q, li, cs]) => {
      if (!q.data) { setNotFound(true); return; }
      setQuote(q.data as unknown as Quote);
      setItems((li.data as LineItem[]) ?? []);
      setCompany(cs.data as Company | null);
      if (searchParams.get("print") === "1") setTimeout(() => window.print(), 600);
    });
  }, [id, searchParams]);

  if (notFound) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Quote not found.</div>;
  if (!quote) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading...</div>;

  const co = company;
  const P = co?.primary_color || "#1a3d6e";
  const S = co?.secondary_color || "#e8edf4";
  const A = co?.accent_color || "#3b82f6";
  const companyName = co?.company_name || "Trevikon IT";
  const cityStateZip = [co?.company_city, co?.company_state, co?.company_zip].filter(Boolean).join(", ");
  const clientCityState = [quote.clients?.city, quote.clients?.state, quote.clients?.zip].filter(Boolean).join(", ");
  const noteLines = (quote.notes ?? "").split("\n").filter(Boolean);
  const defaultNoteLines = (co?.default_notes ?? "").split("\n").filter(Boolean);
  const allNotes = [...noteLines, ...defaultNoteLines];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          .doc { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
        @page { margin: 0.4in; size: letter; }
        .cell-label { background-color: ${S}; font-weight: 600; font-size: 11px; padding: 4px 8px; border-bottom: 1px solid #c8d5e4; }
        .cell-value { font-size: 11px; padding: 4px 8px; border-bottom: 1px solid #e5eaf0; }
      `}</style>

      <div className="min-h-screen bg-gray-200 py-8 px-4">
        <div className="no-print max-w-[850px] mx-auto mb-3 flex justify-end">
          <button onClick={() => window.print()} className="bg-white border shadow-sm text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
            Print / Save PDF
          </button>
        </div>

        <div className="doc max-w-[850px] mx-auto bg-white shadow-xl rounded-lg overflow-hidden" style={{ fontFamily: "Arial, sans-serif" }}>

          {/* ── TOP: Logo + ESTIMATE ── */}
          <div className="flex items-start justify-between px-8 pt-8 pb-4">
            <div>
              {co?.logo_url
                ? <img src={co.logo_url} alt={companyName} style={{ height: 64, maxWidth: 260, objectFit: "contain" }} />
                : <span style={{ fontSize: 32, fontWeight: 900, color: P, letterSpacing: 2 }}>{companyName.toUpperCase()}</span>
              }
            </div>
            <div className="text-right">
              <p style={{ fontSize: 32, fontWeight: 900, color: P, letterSpacing: 3, lineHeight: 1 }}>ESTIMATE</p>
              <p style={{ fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 4 }}>Prepared for the client below</p>
            </div>
          </div>

          {/* ── FROM + Estimate Info ── */}
          <div className="flex gap-6 px-8 pb-5">
            {/* FROM */}
            <div className="flex-1">
              <div style={{ backgroundColor: P, color: "white", fontSize: 11, fontWeight: 700, padding: "3px 8px", marginBottom: 6 }}>FROM</div>
              <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{companyName}</p>
              {co?.company_address && <p style={{ fontSize: 12, color: "#333" }}>{co.company_address}</p>}
              {cityStateZip && <p style={{ fontSize: 12, color: "#333" }}>{cityStateZip}</p>}
              {co?.company_phone && <p style={{ fontSize: 12, color: "#333" }}>{co.company_phone}</p>}
              {co?.company_email && <p style={{ fontSize: 12, color: A }}>{co.company_email}</p>}
            </div>

            {/* Estimate metadata table */}
            <div style={{ width: 280 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid #c8d5e4`, fontSize: 12 }}>
                <tbody>
                  <tr>
                    <td className="cell-label" style={{ backgroundColor: P, color: "white", width: 100 }}>Estimate #</td>
                    <td className="cell-value" style={{ fontWeight: 600 }}>{quote.quote_number}</td>
                  </tr>
                  <tr>
                    <td className="cell-label">Date</td>
                    <td className="cell-value">{new Date(quote.created_at).toLocaleDateString()}</td>
                  </tr>
                  {quote.valid_until && (
                    <tr>
                      <td className="cell-label">Valid Until</td>
                      <td className="cell-value">{new Date(quote.valid_until).toLocaleDateString()}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="cell-label">Prepared By</td>
                    <td className="cell-value">
                      {co?.company_email && <div style={{ color: A }}>{co.company_email}</div>}
                      {co?.company_phone && <div>{co.company_phone}</div>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── PREPARED FOR + PROJECT/SITE ── */}
          <div className="flex gap-6 px-8 pb-6">
            <div className="flex-1">
              <div style={{ backgroundColor: P, color: "white", fontSize: 11, fontWeight: 700, padding: "3px 8px", marginBottom: 6 }}>PREPARED FOR</div>
              {quote.clients ? (
                <>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{quote.clients.name}</p>
                  {quote.clients.address && <p style={{ fontSize: 12, color: "#333" }}>{quote.clients.address}</p>}
                  {clientCityState && <p style={{ fontSize: 12, color: "#333" }}>{clientCityState}</p>}
                  {quote.clients.phone && <p style={{ fontSize: 12, color: "#333" }}>{quote.clients.phone}</p>}
                  {quote.clients.email && <p style={{ fontSize: 12, color: A }}>{quote.clients.email}</p>}
                </>
              ) : (
                <p style={{ fontSize: 12, color: "#999" }}>—</p>
              )}
            </div>
            <div style={{ width: 280 }}>
              <div style={{ backgroundColor: P, color: "white", fontSize: 11, fontWeight: 700, padding: "3px 8px", marginBottom: 6 }}>PROJECT / SITE</div>
              {quote.title && <p style={{ fontWeight: 700, fontSize: 13 }}>{quote.title}</p>}
            </div>
          </div>

          {/* ── LINE ITEMS TABLE ── */}
          <div className="px-8 pb-6">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: P, color: "white" }}>
                  <th style={{ textAlign: "left", padding: "6px 10px", width: "22%" }}>Item</th>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>Description</th>
                  <th style={{ textAlign: "center", padding: "6px 10px", width: "6%" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", width: "12%" }}>Unit Price</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", width: "12%" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5eaf0", backgroundColor: i % 2 === 0 ? "white" : "#f7f9fc" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: P, verticalAlign: "top" }}>
                      {item.item_name || item.description}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#555", verticalAlign: "top", lineHeight: 1.4 }}>
                      {item.item_name ? item.description : ""}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center", verticalAlign: "top" }}>{item.quantity}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", verticalAlign: "top" }}>
                      ${item.unit_price < 0 ? `(${Math.abs(item.unit_price).toFixed(2)})` : item.unit_price.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", verticalAlign: "top" }}>
                      ${item.total < 0 ? `(${Math.abs(item.total).toFixed(2)})` : item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {/* Empty rows to fill space */}
                {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} style={{ borderBottom: "1px solid #e5eaf0", height: 32 }}>
                    <td colSpan={5} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── NOTES + TOTALS ── */}
          <div className="flex gap-6 px-8 pb-8">
            {/* Notes */}
            <div className="flex-1">
              {allNotes.length > 0 && (
                <>
                  <div style={{ backgroundColor: P, color: "white", fontSize: 11, fontWeight: 700, padding: "3px 8px", marginBottom: 6 }}>Notes / Terms</div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {allNotes.map((n, i) => (
                      <li key={i} style={{ fontSize: 11, color: "#444", marginBottom: 3, lineHeight: 1.4 }}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
              {co?.payment_terms && (
                <p style={{ fontSize: 11, color: "#444", marginTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>Payment Terms:</span> {co.payment_terms}
                </p>
              )}
            </div>

            {/* Totals */}
            <div style={{ width: 280 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e5eaf0" }}>
                    <td className="cell-label">Subtotal</td>
                    <td className="cell-value" style={{ textAlign: "right" }}>${quote.subtotal.toFixed(2)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5eaf0" }}>
                    <td className="cell-label">Tax Rate</td>
                    <td className="cell-value" style={{ textAlign: "right" }}>{quote.tax_rate}%</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5eaf0" }}>
                    <td className="cell-label">Tax</td>
                    <td className="cell-value" style={{ textAlign: "right" }}>${quote.tax_amount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={{ backgroundColor: P, color: "white", fontWeight: 700, fontSize: 13, padding: "6px 8px" }}>TOTAL</td>
                    <td style={{ backgroundColor: P, color: "white", fontWeight: 700, fontSize: 13, padding: "6px 8px", textAlign: "right" }}>${quote.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{ borderTop: "1px solid #e5eaf0", padding: "16px 32px", textAlign: "center", fontSize: 12, color: "#666", fontStyle: "italic" }}>
            Thank you for the opportunity to bid on your project. We look forward to partnering with you.
          </div>
        </div>
      </div>
    </>
  );
}
