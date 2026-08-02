"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const DEFAULTS = { primary_color: "#1a3d6e", secondary_color: "#e8edf4", accent_color: "#3b82f6" };
type ColorKey = "primary_color" | "secondary_color" | "accent_color";

const colorMeta: { key: ColorKey; label: string; desc: string }[] = [
  { key: "primary_color", label: "Primary Color", desc: "Document headers, section labels, table bars, totals row" },
  { key: "secondary_color", label: "Background Color", desc: "Light row highlights and label cell backgrounds in tables" },
  { key: "accent_color", label: "Accent Color", desc: "Email addresses and link text on client-facing documents" },
];

export default function AppearancePage() {
  const [colors, setColors] = useState({ ...DEFAULTS });
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("Your Company");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [needsMigration, setNeedsMigration] = useState(false);

  useEffect(() => {
    supabase.from("company_settings")
      .select("id, primary_color, secondary_color, accent_color, company_name, logo_url")
      .limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (error?.message?.includes("column")) { setNeedsMigration(true); return; }
        if (data) {
          setSettingsId(data.id);
          setCompanyName(data.company_name || "Your Company");
          setLogoUrl(data.logo_url);
          setColors({
            primary_color: data.primary_color || DEFAULTS.primary_color,
            secondary_color: data.secondary_color || DEFAULTS.secondary_color,
            accent_color: data.accent_color || DEFAULTS.accent_color,
          });
        }
      });
  }, []);

  function setColor(key: ColorKey, value: string) {
    setColors(c => ({ ...c, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(""); setSaved(false);
    if (!settingsId) { setSaveError("No settings record found."); setSaving(false); return; }
    const { error } = await supabase.from("company_settings").update({
      primary_color: colors.primary_color,
      secondary_color: colors.secondary_color,
      accent_color: colors.accent_color,
    }).eq("id", settingsId);
    if (error) {
      if (error.message.includes("column")) setNeedsMigration(true);
      else setSaveError(error.message);
      setSaving(false); return;
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const P = colors.primary_color;
  const S = colors.secondary_color;
  const A = colors.accent_color;

  return (
    <div className="space-y-8">

      {needsMigration && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-amber-800 mb-2">One-time setup required</p>
          <p className="text-xs text-amber-700 mb-3">Run this SQL in your <a href="https://supabase.com/dashboard" target="_blank" className="underline font-medium">Supabase SQL Editor</a> to add color columns:</p>
          <pre className="bg-amber-100 border border-amber-200 rounded-lg p-3 text-xs font-mono text-amber-900 whitespace-pre overflow-x-auto">{`ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#1a3d6e',
ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#e8edf4',
ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#3b82f6';`}</pre>
          <p className="text-xs text-amber-600 mt-2">After running, refresh this page.</p>
        </div>
      )}

      <div className="grid grid-cols-[1fr_310px] gap-8 items-start">

        {/* Color pickers */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Brand Colors</p>
            <p className="text-sm text-gray-500">Applied to all your quotes, invoices, and client-facing documents.</p>
          </div>

          {colorMeta.map(({ key, label, desc }) => (
            <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-xl border-2 border-gray-200 shadow-sm cursor-pointer overflow-hidden"
                  style={{ backgroundColor: colors[key] }}>
                  <input type="color" value={colors[key]}
                    onChange={e => setColor(key, e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <input type="text" value={colors[key]}
                onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(key, e.target.value); }}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-wider" />
            </div>
          ))}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preset Themes</p>
            <div className="flex flex-wrap gap-2">
              {[
                { name: "Navy (Default)", p: "#1a3d6e", s: "#e8edf4", a: "#3b82f6" },
                { name: "Forest", p: "#1a4731", s: "#e8f4ed", a: "#22c55e" },
                { name: "Slate", p: "#1e293b", s: "#f1f5f9", a: "#64748b" },
                { name: "Burgundy", p: "#7f1d1d", s: "#fdf2f2", a: "#ef4444" },
                { name: "Purple", p: "#4c1d95", s: "#f3f0ff", a: "#8b5cf6" },
                { name: "Teal", p: "#134e4a", s: "#e8f8f7", a: "#14b8a6" },
              ].map(t => (
                <button key={t.name} type="button"
                  onClick={() => setColors({ primary_color: t.p, secondary_color: t.s, accent_color: t.a })}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                  <span className="flex gap-0.5">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.p }} />
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.s }} />
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.a }} />
                  </span>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving || needsMigration}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50 transition">
              {saving ? "Saving…" : "Save Colors"}
            </button>
            {saved && <span className="text-sm text-green-600 font-medium">Saved! Colors will appear on new documents.</span>}
            {saveError && <span className="text-sm text-red-500">{saveError}</span>}
          </div>
        </form>

        {/* Live document preview */}
        <div className="sticky top-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-3">Live Preview</p>
          <div style={{ overflow: "hidden", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", background: "white" }}>
            <div style={{ width: 560, zoom: 0.553, fontFamily: "Arial, sans-serif", fontSize: 11, color: "#333", lineHeight: 1.4 }}>

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "22px 26px 14px" }}>
                {logoUrl
                  ? <img src={logoUrl} alt="" style={{ height: 44, maxWidth: 180, objectFit: "contain" }} />
                  : <span style={{ fontSize: 20, fontWeight: 900, color: P, letterSpacing: 2 }}>{companyName.toUpperCase()}</span>
                }
                <span style={{ fontSize: 22, fontWeight: 900, color: P, letterSpacing: 3 }}>INVOICE</span>
              </div>

              {/* FROM + info table */}
              <div style={{ display: "flex", gap: 18, padding: "0 26px 14px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ backgroundColor: P, color: "white", fontSize: 9, fontWeight: 700, padding: "2px 7px", marginBottom: 4 }}>FROM</div>
                  <p style={{ fontWeight: 700, fontSize: 12, margin: "0 0 2px" }}>Trevikon IT Services</p>
                  <p style={{ margin: "1px 0", color: "#555", fontSize: 10 }}>Richmond, TX 77469</p>
                  <p style={{ margin: "1px 0", color: A, fontSize: 10 }}>sales@trevikon.com</p>
                </div>
                <div style={{ width: 175 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${S}`, fontSize: 10 }}>
                    <tbody>
                      <tr><td style={{ backgroundColor: P, color: "white", fontWeight: 700, padding: "3px 7px", width: 70 }}>Invoice #</td><td style={{ padding: "3px 7px", color: "#999", fontStyle: "italic" }}>INV-0001</td></tr>
                      <tr><td style={{ backgroundColor: S, fontWeight: 600, padding: "3px 7px", borderBottom: `1px solid ${S}` }}>Date</td><td style={{ padding: "3px 7px" }}>{new Date().toLocaleDateString()}</td></tr>
                      <tr><td style={{ backgroundColor: S, fontWeight: 600, padding: "3px 7px" }}>Due Date</td><td style={{ padding: "3px 7px" }}>Net 30</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BILL TO */}
              <div style={{ padding: "0 26px 14px" }}>
                <div style={{ backgroundColor: P, color: "white", fontSize: 9, fontWeight: 700, padding: "2px 7px", marginBottom: 4 }}>BILL TO</div>
                <p style={{ fontWeight: 700, fontSize: 12, margin: 0 }}>Client Company LLC</p>
                <p style={{ color: A, fontSize: 10, margin: "2px 0 0" }}>client@company.com</p>
              </div>

              {/* Line items */}
              <div style={{ padding: "0 26px 14px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr style={{ backgroundColor: P, color: "white" }}>
                      <th style={{ textAlign: "left", padding: "5px 7px", width: "24%" }}>Item</th>
                      <th style={{ textAlign: "left", padding: "5px 7px" }}>Description</th>
                      <th style={{ textAlign: "center", padding: "5px 7px", width: "7%" }}>Qty</th>
                      <th style={{ textAlign: "right", padding: "5px 7px", width: "13%" }}>Price</th>
                      <th style={{ textAlign: "right", padding: "5px 7px", width: "13%" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${S}` }}>
                      <td style={{ padding: "5px 7px", fontWeight: 600, color: P }}>Managed IT</td>
                      <td style={{ padding: "5px 7px", color: "#555" }}>Monthly support package</td>
                      <td style={{ padding: "5px 7px", textAlign: "center" }}>1</td>
                      <td style={{ padding: "5px 7px", textAlign: "right" }}>$500.00</td>
                      <td style={{ padding: "5px 7px", textAlign: "right" }}>$500.00</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${S}`, backgroundColor: S + "80" }}>
                      <td style={{ padding: "5px 7px", fontWeight: 600, color: P }}>Hardware</td>
                      <td style={{ padding: "5px 7px", color: "#555" }}>Network switch install</td>
                      <td style={{ padding: "5px 7px", textAlign: "center" }}>2</td>
                      <td style={{ padding: "5px 7px", textAlign: "right" }}>$199.00</td>
                      <td style={{ padding: "5px 7px", textAlign: "right" }}>$398.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 26px 22px" }}>
                <table style={{ width: 180, borderCollapse: "collapse", fontSize: 10 }}>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${S}` }}><td style={{ backgroundColor: S, fontWeight: 600, padding: "3px 7px" }}>Subtotal</td><td style={{ padding: "3px 7px", textAlign: "right" }}>$898.00</td></tr>
                    <tr style={{ borderBottom: `1px solid ${S}` }}><td style={{ backgroundColor: S, fontWeight: 600, padding: "3px 7px" }}>Tax (8%)</td><td style={{ padding: "3px 7px", textAlign: "right" }}>$71.84</td></tr>
                    <tr><td style={{ backgroundColor: P, color: "white", fontWeight: 700, fontSize: 12, padding: "4px 7px" }}>TOTAL</td><td style={{ backgroundColor: P, color: "white", fontWeight: 700, fontSize: 12, padding: "4px 7px", textAlign: "right" }}>$969.84</td></tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">Updates live as you change colors</p>
        </div>
      </div>
    </div>
  );
}
