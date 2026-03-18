"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [counts, setCounts] = useState({ open: 0, in_progress: 0, waiting: 0 });

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tickets")
        .select("status");
      if (data) {
        setCounts({
          open: data.filter((t) => t.status === "open").length,
          in_progress: data.filter((t) => t.status === "in_progress").length,
          waiting: data.filter((t) => t.status === "waiting").length,
        });
      }
    }
    load();
  }, []);

  const stats = [
    { label: "Open", value: counts.open, color: "text-red-500" },
    { label: "In Progress", value: counts.in_progress, color: "text-yellow-500" },
    { label: "Waiting", value: counts.waiting, color: "text-blue-500" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{s.label} Tickets</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
