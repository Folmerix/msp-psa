"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const inputCls = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    const { error } = await supabase.from("clients").insert({
      name: form.name, email: form.email || null, phone: form.phone || null,
      address: form.address || null, city: form.city || null, state: form.state || null, zip: form.zip || null,
    });
    if (error) { setError(error.message); setLoading(false); }
    else router.push("/dashboard/clients");
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Clients</p>
            <h1 className="text-xl font-bold text-gray-900">New Client</h1>
          </div>
        </div>
        <button type="button" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm">
          {loading ? "Creating…" : "Create Client"}
        </button>
      </div>

      <div className="flex gap-6 p-8 pt-6 overflow-y-auto flex-1">
        <form onSubmit={handleSubmit} className="flex-1 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Company Information</h2>
            <div>
              <label className={labelCls}>Company Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inputCls} placeholder="Acme Corp" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="contact@acme.com" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="(555) 000-0000" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-700 border-b pb-3">Address</h2>
            <div>
              <label className={labelCls}>Street</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div className="col-span-1">
                <label className={labelCls}>City</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} placeholder="Houston" />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inputCls} placeholder="TX" />
              </div>
              <div>
                <label className={labelCls}>ZIP</label>
                <input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} className={inputCls} placeholder="77001" />
              </div>
            </div>
          </div>
        </form>

        {/* Tips panel */}
        <div className="w-72 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tips</p>
            <ul className="space-y-3 text-sm text-gray-500">
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>Only the company name is required.</li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>Email is used for sending quotes and invoices.</li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>Address appears on client-facing documents.</li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold mt-0.5">·</span>You can update all fields later from the client detail page.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
