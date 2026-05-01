"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  actionNode?: ReactNode;
}

export function EmptyState({ icon, title, description, action, actionNode }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border flex flex-col items-center justify-center py-20 text-center gap-4 px-6">
      <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-base">{title}</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">{description}</p>
      </div>
      {actionNode ?? (action && (
        <button
          onClick={action.onClick}
          className="mt-1 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
