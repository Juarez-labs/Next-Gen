import Link from "next/link";

import type { ReactNode } from "react";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const tabs = [
    { href: `/loteria/${projectId}/deck`, label: "Deck" },
    { href: `/loteria/${projectId}/boards`, label: "Boards" },
    { href: `/loteria/${projectId}/export`, label: "Export" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/loteria"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← All projects
        </Link>
        <span className="text-sm text-zinc-400">/</span>
        <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
          {projectId}
        </span>
      </div>
      <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
