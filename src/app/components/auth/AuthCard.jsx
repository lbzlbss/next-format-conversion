'use client';

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="w-full max-w-md">
      <div className="mf-card rounded-[var(--mf-radius-lg)] bg-mf-surface p-6 md:p-8">
        <h1 className="font-mono text-xl font-semibold text-mf-text">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-mf-muted">{subtitle}</p>
        ) : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-4 text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
