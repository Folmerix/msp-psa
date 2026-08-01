import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase.from("invoices").select("id, invoice_number, title, total").eq("id", id).single(),
    supabase.from("company_settings").select("payment_provider, stripe_secret_key, stripe_mode, paypal_client_id, paypal_client_secret, paypal_mode, square_access_token, square_location_id, default_payment_link").limit(1).maybeSingle(),
  ]);

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const provider = settings?.payment_provider ?? "manual";
  const invoiceLabel = invoice.title || `Invoice ${invoice.invoice_number}`;
  const successUrl = `${APP_URL}/inv/${id}?paid=1`;
  const cancelUrl = `${APP_URL}/inv/${id}`;

  // ── STRIPE ──────────────────────────────────────────────
  if (provider === "stripe") {
    const secretKey = settings?.stripe_secret_key;
    if (!secretKey) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secretKey, { apiVersion: "2025-06-30.basil" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: invoiceLabel },
          unit_amount: Math.round(invoice.total * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { invoice_id: id },
    });

    return NextResponse.redirect(session.url!);
  }

  // ── PAYPAL ───────────────────────────────────────────────
  if (provider === "paypal") {
    const { paypal_client_id: clientId, paypal_client_secret: clientSecret, paypal_mode: mode } = settings ?? {};
    if (!clientId || !clientSecret) return NextResponse.json({ error: "PayPal not configured" }, { status: 500 });

    const base = mode === "live" ? "https://api.paypal.com" : "https://api.sandbox.paypal.com";

    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const { access_token } = await tokenRes.json();

    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: invoice.total.toFixed(2) },
          description: invoiceLabel,
        }],
        application_context: { return_url: successUrl, cancel_url: cancelUrl },
      }),
    });
    const order = await orderRes.json();
    const approvalUrl = order.links?.find((l: { rel: string; href: string }) => l.rel === "approve")?.href;
    if (!approvalUrl) return NextResponse.json({ error: "PayPal order failed" }, { status: 500 });

    return NextResponse.redirect(approvalUrl);
  }

  // ── SQUARE ───────────────────────────────────────────────
  if (provider === "square") {
    const { square_access_token: token, square_location_id: locationId } = settings ?? {};
    if (!token || !locationId) return NextResponse.json({ error: "Square not configured" }, { status: 500 });

    const squareRes = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Square-Version": "2024-01-18" },
      body: JSON.stringify({
        idempotency_key: `${id}-${Date.now()}`,
        order: {
          location_id: locationId,
          line_items: [{
            name: invoiceLabel,
            quantity: "1",
            base_price_money: { amount: Math.round(invoice.total * 100), currency: "USD" },
          }],
        },
        checkout_options: { redirect_url: successUrl },
      }),
    });
    const { payment_link, errors } = await squareRes.json();
    if (errors || !payment_link?.url) return NextResponse.json({ error: "Square checkout failed" }, { status: 500 });

    return NextResponse.redirect(payment_link.url);
  }

  // ── MANUAL ───────────────────────────────────────────────
  const manualLink = settings?.default_payment_link;
  if (manualLink) return NextResponse.redirect(manualLink);

  return NextResponse.json({ error: "No payment method configured" }, { status: 400 });
}
