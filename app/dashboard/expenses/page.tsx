"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CATEGORIES = ["Software / SaaS", "Tools & Equipment", "Infrastructure", "Marketing", "Labor / Contractors", "Licensing", "Office & Admin", "Other"];
const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
  { value: "one_time", label: "One-time" },
];

type Expense = {
  id: string;
  name: string;
  vendor: string | null;
  category: string;
  amount: number;
  billing_cycle: string;
  notes: string | null;
  status: string;
  start_date: string | null;
};

const blank = { name: "", vendor: "", category: "Software / SaaS", amount: "", billing_cycle: "monthly", notes: "", start_date: "" };
const inputCls = "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

function monthlyCost(e: Expense) {
  if (e.billing_cycle === "annual") return e.amount / 12;
  if (e.billing_cycle === "one_time") return 0;
  return e.amount;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"active" | "cancelled">("active");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("expenses").select("*").order("category").order("name");
    setExpenses((data as Expense[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const active = expenses.filter(e => e.status === "active");
  const shown = expenses.filter(e => e.status === filterStatus);
  const totalMonthly = active.reduce((s, e) => s + monthlyCost(e), 0);
  const totalAnnual = active.filter(e => e.billing_cycle === "annual").reduce((s, e) => s + e.amount, 0);
  const totalOneTime = active.filter(e => e.billing_cycle === "one_time").reduce((s, e) => s + e.amount, 0);

  function openNew() {
    setEditingId(null);
    setForm(blank);
    setShowForm(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({ name: e.name, vendor: e.vendor ?? "", category: e.category, amount: String(e.amount), billing_cycle: e.billing_cycle, notes: e.notes ?? "", start_date: e.start_date ?? "" });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.amount) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      vendor: form.vendor.trim() || null,
      category: form.category,
      amount: parseFloat(form.amount),
      billing_cycle: form.billing_cycle,
      notes: form.notes.trim() || null,
      start_date: form.start_date || null,
      status: "active",
    };
    if (editingId) {
      await supabase.from("expenses").update(payload).eq("id", editingId);
    } else {
      await supabase.from("expenses").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function handleCancel(id: string) {
    await supabase.from("expenses").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  async function handleReactivate(id: string) {
    await supabase.from("expenses").update({ status: "active" }).eq("id", id);
    load();
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Company operating costs and subscriptions</p>
        </div>
        <button onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm">
          + Add Expense
        </button>
      </div>

      <div className="p-8 pt-6 space-y-5 overflow-y-auto flex-1">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Monthly Recurring</p>
            <p className="text-2xl font-bold text-red-600">${totalMonthly.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{active.filter(e => e.billing_cycle !== "one_time").length} active expenses</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Annual Contracts</p>
            <p className="text-2xl font-bold text-gray-900">${totalAnnual.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">${(totalAnnual / 12).toFixed(2)}/mo equivalent</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">One-time</p>
            <p className="text-2xl font-bold text-gray-900">${totalOneTime.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{active.filter(e => e.billing_cycle === "one_time").length} items</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(["active", "cancelled"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition capitalize ${filterStatus === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {shown.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-gray-400 text-sm mb-3">No {filterStatus} expenses yet.</p>
              {filterStatus === "active" && (
                <button onClick={openNew} className="text-blue-600 text-sm font-semibold hover:underline">+ Add your first expense</button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Billing</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly Cost</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shown.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{e.name}</p>
                      {e.vendor && <p className="text-xs text-gray-400 mt-0.5">{e.vendor}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{e.category}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700 font-medium">${e.amount.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        e.billing_cycle === "monthly" ? "bg-blue-50 text-blue-600" :
                        e.billing_cycle === "annual" ? "bg-purple-50 text-purple-600" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {BILLING_CYCLES.find(b => b.value === e.billing_cycle)?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {e.billing_cycle === "one_time" ? (
                        <span className="text-gray-400 text-xs">—</span>
                      ) : (
                        <span className="font-semibold text-gray-900">${monthlyCost(e).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEdit(e)} className="text-xs text-gray-400 hover:text-blue-600 font-medium transition">Edit</button>
                        {e.status === "active" ? (
                          <button onClick={() => handleCancel(e.id)} className="text-xs text-gray-400 hover:text-red-500 font-medium transition">Cancel</button>
                        ) : (
                          <button onClick={() => handleReactivate(e.id)} className="text-xs text-gray-400 hover:text-green-600 font-medium transition">Reactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="font-bold text-gray-900 text-lg mb-5">{editingId ? "Edit Expense" : "Add Expense"}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Microsoft 365 Business Premium" />
                </div>
                <div>
                  <label className={labelCls}>Vendor</label>
                  <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className={inputCls} placeholder="Microsoft" />
                </div>
                <div>
                  <label className={labelCls}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelCls}>Billing Cycle</label>
                  <select value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))} className={inputCls}>
                    {BILLING_CYCLES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Optional notes" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.amount}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 transition">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
