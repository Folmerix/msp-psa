"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = { id: string; name: string };

export default function NewContractPage() {
  return <Suspense><NewContractForm /></Suspense>;
}

function NewContractForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledClient = searchParams.get("client") ?? "";

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(prefilledClient);
  const [name, setName] = useState("Managed Services");
  const [amount, setAmount] = useState("");
  const [billingDay, setBillingDay] = useState("1");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("id, name").eq("active", true).order("name").then(({ data }) => {
      setClients((data as Client[]) ?? []);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("contracts").insert({
      client_id: clientId,
      name,
      amount: parseFloat(amount),
      billing_day: parseInt(billingDay),
      start_date: startDate,
    });

    if (!error) {
      router.push("/dashboard/contracts");
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-xl font-semibold">New Contract</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label htmlFor="client" className="block text-sm font-medium mb-1">Client *</label>
          <select
            id="client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">— Select client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Contract Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Managed Services"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium mb-1">Monthly Amount ($) *</label>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="500.00"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="billingDay" className="block text-sm font-medium mb-1">Billing Day of Month</label>
            <input
              id="billingDay"
              type="number"
              min="1"
              max="28"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-gray-400 mt-1">Day 1–28 (used as reference)</p>
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium mb-1">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !clientId || !amount}
          className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Contract"}
        </button>
      </form>
    </div>
  );
}
