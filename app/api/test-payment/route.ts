import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const config = await req.json();
  const { payment_provider: provider } = config;

  try {
    if (provider === "stripe") {
      if (!config.stripe_secret_key) return NextResponse.json({ ok: false, message: "No secret key provided" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(config.stripe_secret_key, { apiVersion: "2026-07-29.dahlia" });
      await stripe.balance.retrieve();
      return NextResponse.json({ ok: true, message: "✓ Stripe connected successfully" });
    }

    if (provider === "paypal") {
      if (!config.paypal_client_id || !config.paypal_client_secret) return NextResponse.json({ ok: false, message: "Client ID and Secret required" });
      const base = config.paypal_mode === "live" ? "https://api.paypal.com" : "https://api.sandbox.paypal.com";
      const res = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.paypal_client_id}:${config.paypal_client_secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      const data = await res.json();
      if (data.access_token) return NextResponse.json({ ok: true, message: "✓ PayPal connected successfully" });
      return NextResponse.json({ ok: false, message: data.error_description ?? "Connection failed" });
    }

    if (provider === "square") {
      if (!config.square_access_token) return NextResponse.json({ ok: false, message: "Access token required" });
      const res = await fetch("https://connect.squareup.com/v2/locations", {
        headers: { Authorization: `Bearer ${config.square_access_token}`, "Square-Version": "2024-01-18" },
      });
      const data = await res.json();
      if (data.locations) return NextResponse.json({ ok: true, message: `✓ Square connected — ${data.locations.length} location(s) found` });
      return NextResponse.json({ ok: false, message: data.errors?.[0]?.detail ?? "Connection failed" });
    }

    return NextResponse.json({ ok: false, message: "Unknown provider" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Connection failed";
    return NextResponse.json({ ok: false, message: msg });
  }
}
