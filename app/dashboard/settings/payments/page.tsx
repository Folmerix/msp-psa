"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Provider = "stripe" | "paypal" | "square" | "manual";

type PaymentConfig = {
  id?: string;
  payment_provider: Provider;
  default_payment_link: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  stripe_mode: "test" | "live";
  paypal_client_id: string;
  paypal_client_secret: string;
  paypal_mode: "sandbox" | "live";
  square_access_token: string;
  square_location_id: string;
};

const empty: PaymentConfig = {
  payment_provider: "manual",
  default_payment_link: "",
  stripe_publishable_key: "",
  stripe_secret_key: "",
  stripe_mode: "test",
  paypal_client_id: "",
  paypal_client_secret: "",
  paypal_mode: "sandbox",
  square_access_token: "",
  square_location_id: "",
};

const providers: { id: Provider; label: string; description: string; logo: string }[] = [
  { id: "stripe", label: "Stripe", description: "Credit/debit cards, Apple Pay, Google Pay", logo: "💳" },
  { id: "paypal", label: "PayPal", description: "PayPal, Venmo, Pay Later", logo: "🅿️" },
  { id: "square", label: "Square", description: "Cards, Apple Pay, Google Pay", logo: "⬛" },
  { id: "manual", label: "Custom Link", description: "Any payment URL — Zelle, bank transfer, etc.", logo: "🔗" },
];

export default function PaymentsSettingsPage() {
  const [config, setConfig] = useState<PaymentConfig>(empty);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    supabase.from("company_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (!data) return;
      setSettingsId(data.id);
      setConfig({
        payment_provider: (data.payment_provider as Provider) ?? "manual",
        default_payment_link: data.default_payment_link ?? "",
        stripe_publishable_key: data.stripe_publishable_key ?? "",
        stripe_secret_key: data.stripe_secret_key ?? "",
        stripe_mode: (data.stripe_mode as "test" | "live") ?? "test",
        paypal_client_id: data.paypal_client_id ?? "",
        paypal_client_secret: data.paypal_client_secret ?? "",
        paypal_mode: (data.paypal_mode as "sandbox" | "live") ?? "sandbox",
        square_access_token: data.square_access_token ?? "",
        square_location_id: data.square_location_id ?? "",
      });
    });
  }, []);

  function set<K extends keyof PaymentConfig>(field: K, value: PaymentConfig[K]) {
    setConfig(c => ({ ...c, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setTestResult(null);

    const payload = {
      payment_provider: config.payment_provider,
      default_payment_link: config.default_payment_link || null,
      stripe_publishable_key: config.stripe_publishable_key || null,
      stripe_secret_key: config.stripe_secret_key || null,
      stripe_mode: config.stripe_mode,
      paypal_client_id: config.paypal_client_id || null,
      paypal_client_secret: config.paypal_client_secret || null,
      paypal_mode: config.paypal_mode,
      square_access_token: config.square_access_token || null,
      square_location_id: config.square_location_id || null,
    };

    if (settingsId) {
      await supabase.from("company_settings").update(payload).eq("id", settingsId);
    } else {
      const { data } = await supabase.from("company_settings").insert(payload).select().single();
      if (data) setSettingsId(data.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/test-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    setTestResult(data);
    setTesting(false);
  }

  const selected = config.payment_provider;

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* Provider selector */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Provider</h2>
        <div className="grid grid-cols-2 gap-3">
          {providers.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => set("payment_provider", p.id)}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                selected === p.id
                  ? "border-black bg-black text-white"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <span className="text-2xl">{p.logo}</span>
              <div>
                <p className={`font-semibold text-sm ${selected === p.id ? "text-white" : "text-gray-900"}`}>{p.label}</p>
                <p className={`text-xs mt-0.5 ${selected === p.id ? "text-gray-300" : "text-gray-400"}`}>{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Stripe config */}
      {selected === "stripe" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Stripe Configuration</h2>
            <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
              <button type="button" onClick={() => set("stripe_mode", "test")}
                className={`px-3 py-1.5 ${config.stripe_mode === "test" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                Test
              </button>
              <button type="button" onClick={() => set("stripe_mode", "live")}
                className={`px-3 py-1.5 ${config.stripe_mode === "live" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                Live
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Find your API keys at <span className="font-medium text-gray-600">dashboard.stripe.com → Developers → API keys</span>
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Publishable Key</label>
            <input type="text" value={config.stripe_publishable_key}
              onChange={e => set("stripe_publishable_key", e.target.value)}
              placeholder={config.stripe_mode === "test" ? "pk_test_..." : "pk_live_..."}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Secret Key</label>
            <input type="password" value={config.stripe_secret_key}
              onChange={e => set("stripe_secret_key", e.target.value)}
              placeholder={config.stripe_mode === "test" ? "sk_test_..." : "sk_live_..."}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
            <p className="text-xs text-gray-400 mt-1">Stored securely. Never shared with clients.</p>
          </div>
          {testResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${testResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {testResult.message}
            </div>
          )}
          <button type="button" onClick={testConnection} disabled={testing || !config.stripe_secret_key}
            className="border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>
      )}

      {/* PayPal config */}
      {selected === "paypal" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">PayPal Configuration</h2>
            <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
              <button type="button" onClick={() => set("paypal_mode", "sandbox")}
                className={`px-3 py-1.5 ${config.paypal_mode === "sandbox" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                Sandbox
              </button>
              <button type="button" onClick={() => set("paypal_mode", "live")}
                className={`px-3 py-1.5 ${config.paypal_mode === "live" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                Live
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Find your credentials at <span className="font-medium text-gray-600">developer.paypal.com → My Apps & Credentials</span>
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Client ID</label>
            <input type="text" value={config.paypal_client_id}
              onChange={e => set("paypal_client_id", e.target.value)}
              placeholder="AaBbCcDd..."
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Client Secret</label>
            <input type="password" value={config.paypal_client_secret}
              onChange={e => set("paypal_client_secret", e.target.value)}
              placeholder="EeFfGgHh..."
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          {testResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${testResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {testResult.message}
            </div>
          )}
          <button type="button" onClick={testConnection} disabled={testing || !config.paypal_client_id}
            className="border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>
      )}

      {/* Square config */}
      {selected === "square" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold">Square Configuration</h2>
          <p className="text-xs text-gray-400">
            Find your credentials at <span className="font-medium text-gray-600">developer.squareup.com → My Applications</span>
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Access Token</label>
            <input type="password" value={config.square_access_token}
              onChange={e => set("square_access_token", e.target.value)}
              placeholder="EAAAl..."
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location ID</label>
            <input type="text" value={config.square_location_id}
              onChange={e => set("square_location_id", e.target.value)}
              placeholder="LXXXXXXXXXXXXXXXXX"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
            <p className="text-xs text-gray-400 mt-1">Found under Locations in your Square dashboard.</p>
          </div>
          {testResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${testResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {testResult.message}
            </div>
          )}
          <button type="button" onClick={testConnection} disabled={testing || !config.square_access_token}
            className="border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>
      )}

      {/* Manual config */}
      {selected === "manual" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold">Custom Payment Link</h2>
          <p className="text-xs text-gray-400">
            Paste any payment URL — Venmo, Zelle, bank transfer, or a Stripe/PayPal payment link.
            This link will appear as a "Pay Now" button on every invoice.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Payment URL</label>
            <input type="url" value={config.default_payment_link}
              onChange={e => set("default_payment_link", e.target.value)}
              placeholder="https://venmo.com/u/yourname or https://buy.stripe.com/..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            Note: with a static link, the payment amount is not enforced. For exact-amount checkout, use Stripe, PayPal, or Square above.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="bg-black text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          {saving ? "Saving..." : "Save Payment Settings"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </form>
  );
}
