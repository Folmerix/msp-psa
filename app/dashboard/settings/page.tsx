"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type CompanySettings = {
  id?: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_address: string;
  company_city: string;
  company_state: string;
  company_zip: string;
  logo_url: string;
  tax_rate: string;
  invoice_prefix: string;
  quote_prefix: string;
  payment_terms: string;
  default_notes: string;
  default_payment_link: string;
};

const empty: CompanySettings = {
  company_name: "",
  company_email: "",
  company_phone: "",
  company_address: "",
  company_city: "",
  company_state: "",
  company_zip: "",
  logo_url: "",
  tax_rate: "0",
  invoice_prefix: "INV",
  quote_prefix: "QT",
  payment_terms: "Net 30",
  default_notes: "",
  default_payment_link: "",
};

export default function SettingsPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [company, setCompany] = useState<CompanySettings>(empty);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (profile) setFullName(profile.full_name ?? "");

      const { data: cs } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      if (cs) {
        setCompanyId(cs.id);
        setCompany({
          company_name: cs.company_name ?? "",
          company_email: cs.company_email ?? "",
          company_phone: cs.company_phone ?? "",
          company_address: cs.company_address ?? "",
          company_city: cs.company_city ?? "",
          company_state: cs.company_state ?? "",
          company_zip: cs.company_zip ?? "",
          logo_url: cs.logo_url ?? "",
          tax_rate: String(cs.tax_rate ?? "0"),
          invoice_prefix: cs.invoice_prefix ?? "INV",
          quote_prefix: cs.quote_prefix ?? "QT",
          payment_terms: cs.payment_terms ?? "Net 30",
          default_notes: cs.default_notes ?? "",
          default_payment_link: cs.default_payment_link ?? "",
        });
      }
    }
    load();
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", userId);
    setSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  async function handleCompanySave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...company, tax_rate: parseFloat(company.tax_rate || "0") };
    if (companyId) {
      await supabase.from("company_settings").update(payload).eq("id", companyId);
    } else {
      const { data } = await supabase.from("company_settings").insert(payload).select().single();
      if (data) setCompanyId(data.id);
    }
    setSaving(false);
    setCompanySaved(true);
    setTimeout(() => setCompanySaved(false), 3000);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoError("");
    const ext = file.name.split(".").pop();
    const path = `logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) {
      setLogoError(`Upload failed: ${error.message}`);
    } else {
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
      setCompany(c => ({ ...c, logo_url: urlData.publicUrl }));
    }
    setLogoUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function set(field: keyof CompanySettings, value: string) {
    setCompany(c => ({ ...c, [field]: value }));
  }

  return (
    <div className="space-y-6">

      {/* Profile */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Profile</h2>
        <form onSubmit={handleProfileSave} className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input value={email} disabled
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="bg-black text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {saving ? "Saving..." : "Save Profile"}
            </button>
            {profileSaved && <span className="text-sm text-green-600">Saved!</span>}
          </div>
        </form>
      </section>

      {/* Company */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Company</h2>
        <form onSubmit={handleCompanySave} className="bg-white rounded-xl border p-6 space-y-5">

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium mb-2">Logo</label>
            <div className="flex items-center gap-4">
              {company.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="h-14 max-w-[180px] object-contain border rounded-lg p-1 bg-gray-50" />
              ) : (
                <div className="h-14 w-36 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-300 text-xs">No logo</div>
              )}
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="border rounded-lg px-4 py-1.5 text-sm hover:bg-gray-50">
                  {logoUploading ? "Uploading..." : "Upload Logo"}
                </button>
                {company.logo_url && (
                  <button type="button" onClick={() => setCompany(c => ({ ...c, logo_url: "" }))}
                    className="text-xs text-red-400 hover:text-red-600">Remove</button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
            <p className="text-xs text-gray-400 mt-1">PNG or SVG recommended. Will appear on quotes and invoices.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input value={company.company_name} onChange={e => set("company_name", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={company.company_email} onChange={e => set("company_email", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input type="tel" value={company.company_phone} onChange={e => set("company_phone", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <input value={company.company_address} onChange={e => set("company_address", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input value={company.company_city} onChange={e => set("company_city", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <input value={company.company_state} onChange={e => set("company_state", e.target.value)} maxLength={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ZIP</label>
                <input value={company.company_zip} onChange={e => set("company_zip", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Default Tax Rate (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={company.tax_rate} onChange={e => set("tax_rate", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Terms</label>
              <input value={company.payment_terms} onChange={e => set("payment_terms", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Invoice Prefix</label>
              <input value={company.invoice_prefix} onChange={e => set("invoice_prefix", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quote Prefix</label>
              <input value={company.quote_prefix} onChange={e => set("quote_prefix", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Default Notes / Footer</label>
              <textarea value={company.default_notes} onChange={e => set("default_notes", e.target.value)} rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="bg-black text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {saving ? "Saving..." : "Save Company Info"}
            </button>
            {companySaved && <span className="text-sm text-green-600">Saved!</span>}
          </div>
        </form>
      </section>
    </div>
  );
}
