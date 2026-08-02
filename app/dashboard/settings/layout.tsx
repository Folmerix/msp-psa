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
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your company profile and billing configuration.</p>
      </div>

      <div className="flex gap-1 mb-8 border-b border-gray-200">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              pathname === tab.href
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
