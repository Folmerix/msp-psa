"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "General", href: "/dashboard/settings" },
  { label: "Payments", href: "/dashboard/settings/payments" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-5">Settings</h1>
      <div className="flex gap-1 mb-6 border-b">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              pathname === tab.href
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
