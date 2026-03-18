"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (data) setFullName(data.full_name ?? "");
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", userId);

    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Profile Settings</h1>

      <form onSubmit={handleSave} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium mb-1">Full Name</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            disabled
            className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </form>
    </div>
  );
}
