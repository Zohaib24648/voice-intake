import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { apiDocsUrl } from '@/lib/api';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lakeside Clinic Patient Registry',
  description: 'Patients registered through the voice intake agent.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Lakeside Clinic <span className="font-normal text-zinc-500">Patient Registry</span>
            </Link>
            <a
              href={apiDocsUrl()}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              target="_blank"
              rel="noreferrer"
            >
              API docs
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
