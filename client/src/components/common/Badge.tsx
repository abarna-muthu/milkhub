import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'default'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'morning'
    | 'evening'
    | 'cow'
    | 'buffalo';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[10px] font-medium leading-none',
    md: 'px-2 py-0.5 text-xs font-medium',
  };

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200',
    info: 'bg-sky-50 text-sky-800 border border-sky-200',
    morning: 'bg-amber-50 text-amber-800 border border-amber-300',
    evening: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
    cow: 'bg-emerald-50 text-emerald-800 border border-emerald-300',
    buffalo: 'bg-slate-100 text-slate-800 border border-slate-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
