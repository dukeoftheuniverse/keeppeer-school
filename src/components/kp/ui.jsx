import React from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PagePanel({ children, className }) {
  return <div className={cn("kp-panel rounded-2xl shadow-lg p-4 sm:p-6", className)}>{children}</div>;
}

export function PageTitle({ children, subtitle, className }) {
  return (
    <div className={cn("mb-4", className)}>
      <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--kp-teal))]">{children}</h1>
      {subtitle && <p className="text-sm mt-0.5 text-[hsl(var(--foreground))]">{subtitle}</p>}
    </div>);

}

export function StatusBadge({ status, className }) {
  const map = {
    active: 'bg-green-100 text-green-700',
    enrolled: 'bg-green-100 text-green-700',
    present: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    deactivated: 'bg-red-100 text-red-700',
    absent: 'bg-red-100 text-red-700',
    archived: 'bg-gray-100 text-gray-500',
    transferred: 'bg-orange-100 text-orange-700',
    pending: 'bg-yellow-100 text-yellow-700',
    late: 'bg-orange-100 text-orange-700',
    excused: 'bg-blue-100 text-blue-700',
    half_day: 'bg-purple-100 text-purple-700',
    admin: 'bg-teal-100 text-teal-700',
    teacher: 'bg-indigo-100 text-indigo-700',
    staff: 'bg-blue-100 text-blue-700'
  };
  return <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", map[String(status).toLowerCase()] || 'bg-gray-100 text-gray-500', className)}>{status}</span>;
}

export function KpButton({ children, variant = 'green', className, ...props }) {
  const variants = {
    teal: 'bg-[hsl(var(--kp-teal))] text-white hover:bg-[hsl(var(--kp-teal-dark))]',
    green: 'bg-[hsl(var(--kp-green))] text-white hover:bg-[hsl(var(--kp-green-dark))]',
    outline: 'bg-white text-[hsl(var(--kp-teal))] border border-[hsl(var(--kp-teal))]/25 hover:bg-[hsl(var(--accent))]',
    ghost: 'bg-transparent text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))]',
    danger: 'bg-[hsl(var(--kp-red))] text-white hover:brightness-110',
    light: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  };
  return (
    <button className={cn("inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50", variants[variant], className)} {...props}>
      {children}
    </button>);

}

export function KpInput({ label, className, ...props }) {
  return (
    <div>
      {label && <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">{label}</label>}
      <input
        className={cn("w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15 focus:border-[hsl(var(--kp-teal))]", className)}
        {...props} />
      
    </div>);

}

export function KpSelect({ label, children, className, ...props }) {
  return (
    <div>
      {label && <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">{label}</label>}
      <select
        className={cn("w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15 focus:border-[hsl(var(--kp-teal))]", className)}
        {...props}>
        
        {children}
      </select>
    </div>);

}

export function SearchInput({ value, onChange, placeholder = 'Search...', className }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15 focus:border-[hsl(var(--kp-teal))]" />
      
    </div>);

}

export function Pagination({ page, totalPages, onPageChange }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-[hsl(var(--kp-teal))] disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1">
        <ChevronLeft className="w-3.5 h-3.5" /> Previous
      </button>
      <span className="px-3.5 py-1.5 rounded-lg text-sm bg-[hsl(var(--kp-teal))] text-white font-medium">{page}</span>
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-[hsl(var(--kp-teal))] disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1">
        Next <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>);

}

export function EmptyState({ message = 'No records found' }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-sm">{message}</p>
    </div>);

}

export function Avatar({ name, src, size = 'w-9 h-9' }) {
  const initials = name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (src) return <img src={src} alt={name} className={cn(size, "rounded-full object-cover")} />;
  return <div className={cn(size, "rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-semibold")}>{initials}</div>;
}