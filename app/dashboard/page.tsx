"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type FinancialSummary = {
  mrr: number;
  vendorCosts: number;
  monthlyExpenses: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState({ open: 0, inProgress: 0, quotesDraft: 0, outstanding: 0 });
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("tickets").select("status"),
      supabase.from("quotes").select("status"),
      supabase.from("invoices").select("status, total"),
    ]).then(([tickets, quotes, invoices]) => {
      const t = tickets.data ?? [];
      const q = quotes.data ?? [];
      const inv = invoices.data ?? [];
      setStats({
        open: t.filter(x => x.status === "open").length,
        inProgress: t.filter(x => x.status === "in_progress").length,
        quotesDraft: q.filter(x => x.status === "draft" || x.status === "sent").length,
        outstanding: inv.filter(x => x.status === "sent" || x.status === "overdue").reduce((s, x) => s + (x.total ?? 0), 0),
      });
    });

    // Financial summary: MRR and vendor costs from subscriptions, operating expenses table
    Promise.all([
      supabase.from("subscriptions").select("seats, price_per_seat, cost_per_seat, discount_percent, status").eq("status", "active"),
      supabase.from("expenses").select("amount, quantity, billing_cycle, status").eq("status", "active"),
    ]).then(([subs, exps]) => {
      const mrr = (subs.data ?? []).reduce((s, sub) => {
        return s + sub.seats * sub.price_per_seat * (1 - (sub.discount_percent || 0) / 100);
      }, 0);
      const vendorCosts = (subs.data ?? []).reduce((s, sub) => {
        return s + sub.seats * sub.cost_per_seat;
      }, 0);
      const monthlyExpenses = (exps.data ?? []).reduce((s, exp) => {
        const qty = exp.quantity || 1;
        if (exp.billing_cycle === "monthly") return s + exp.amount * qty;
        if (exp.billing_cycle === "annual") return s + (exp.amount * qty) / 12;
        return s; // one_time excluded
      }, 0);
      setFinancial({ mrr, vendorCosts, monthlyExpenses });
    });
  }, []);

  const profit = financial ? financial.mrr - financial.vendorCosts - financial.monthlyExpenses : 0;
  const margin = financial && financial.mrr > 0 ? (profit / financial.mrr) * 100 : 0;

  const cards = [
    { label: "Open Tickets", value: stats.open, sub: "Need attention", color: "text-red-600", bg: "bg-red-50", href: "/dashboard/tickets",
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg> },
    { label: "In Progress", value: stats.inProgress, sub: "Being worked on", color: "text-yellow-600", bg: "bg-yellow-50", href: "/dashboard/tickets",
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> },
    { label: "Active Quotes", value: stats.quotesDraft, sub: "Draft or sent", color: "text-blue-600", bg: "bg-blue-50", href: "/dashboard/quotes",
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg> },
    { label: "Outstanding", value: `$${stats.outstanding.toFixed(2)}`, sub: "Unpaid invoices", color: "text-green-700", bg: "bg-green-50", href: "/dashboard/invoices",
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> },
  ];

  const quickLinks = [
    { label: "New Ticket", href: "/dashboard/tickets/new", desc: "Log a support issue" },
    { label: "New Quote", href: "/dashboard/quotes/new", desc: "Create an estimate" },
    { label: "New Invoice", href: "/dashboard/invoices/new", desc: "Bill a client" },
    { label: "New Client", href: "/dashboard/clients/new", desc: "Add a customer" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back — here&apos;s what&apos;s happening.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {cards.map(c => (
          <Link key={c.label} href={c.href}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <span className={`${c.bg} ${c.color} p-2 rounded-lg`}>{c.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{c.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </Link>
        ))}
      </div>

      {/* P&L Summary */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly P&amp;L</h2>
          <div className="flex gap-3">
            <Link href="/dashboard/subscriptions" className="text-xs text-gray-400 hover:text-blue-600 transition">Subscriptions →</Link>
            <Link href="/dashboard/expenses" className="text-xs text-gray-400 hover:text-blue-600 transition">Expenses →</Link>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {financial === null ? (
            <div className="px-6 py-5 text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Client MRR</p>
                <p className="text-2xl font-bold text-green-600">${financial.mrr.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">Billed to clients</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Vendor Costs</p>
                <p className="text-2xl font-bold text-red-500">${financial.vendorCosts.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">Paid to Pax8 / vendors</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Operating Expenses</p>
                <p className="text-2xl font-bold text-red-500">${financial.monthlyExpenses.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">Tools, software, etc.</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Gross Profit</p>
                <p className={`text-2xl font-bold ${profit >= 0 ? "text-gray-900" : "text-red-600"}`}>${profit.toFixed(2)}</p>
                <p className={`text-xs mt-1 font-semibold ${margin >= 50 ? "text-green-600" : margin >= 20 ? "text-yellow-600" : "text-red-500"}`}>
                  {financial.mrr > 0 ? `${margin.toFixed(0)}% margin` : "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-4">
          {quickLinks.map(l => (
            <Link key={l.label} href={l.href}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{l.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{l.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
