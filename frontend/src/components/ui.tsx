import React from "react";
import { clsx } from "clsx";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx(
      "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-900",
      className
    )} {...p} />
  );
}

export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-5 pt-5 pb-2", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx("text-base font-semibold", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-5 pb-5", className)} {...p} />;
}

export function Button({ className, variant = "primary", size = "md", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md";
}) {
  const variants = {
    primary: "bg-accent-500 hover:bg-accent-600 text-white",
    secondary: "bg-navy-700 hover:bg-navy-600 text-white",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    outline: "border border-slate-300 dark:border-navy-600 hover:bg-slate-100 dark:hover:bg-navy-800",
    ghost: "hover:bg-slate-100 dark:hover:bg-navy-800",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button
      className={clsx("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:pointer-events-none", variants[variant], sizes[size], className)}
      {...p}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500",
        props.className
      )}
    />
  );
}

export function Badge({ className, tone = "slate", ...p }: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "slate" | "green" | "red" | "amber" | "blue" | "purple";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-navy-700 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    purple: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)} {...p} />;
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={clsx("w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700 px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-navy-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-navy-800">{children}</tbody>
      </table>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}
