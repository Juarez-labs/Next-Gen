import Link from "next/link";

import type { ReactNode } from "react";

export default function LoteriaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/loteria" className="text-lg font-semibold tracking-tight">
            Lotería <span className="text-zinc-500">Builder</span>
          </Link>
          <nav className="text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/loteria" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              Projects
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
