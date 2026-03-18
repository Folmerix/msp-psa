"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, name, email, phone, active, created_at")
      .order("name")
      .then(({ data }) => {
        setClients((data as Client[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Link
          href="/dashboard/clients/new"
          className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          + New Client
        </Link>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading...</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No clients yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/clients/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
