"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    label: "General", href: "/dashboard/settings",
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  },
  {
    label: "Payments", href: "/dashboard/settings/payments",
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      {/* Settings sub-nav */}
      <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 py-8 px-3">
        <div className="px-3 mb-6">
          <h1 className="text-lg font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400 mt-0.5">Account & billing</p>
        </div>
        <nav className="space-y-0.5">
          {tabs.map(tab => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}>
                <span className={active ? "text-blue-600" : "text-gray-400"}>{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="px-10 py-8 max-w-4xl">
          {children}
        </div>
      </div>
    </div>
  );
}
