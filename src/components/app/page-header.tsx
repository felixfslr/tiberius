import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Crumb = { href: string; label: string };

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        {crumbs && crumbs.length > 0 ? (
          <nav className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                <Link
                  href={c.href}
                  className="rounded transition-colors hover:text-foreground"
                >
                  {c.label}
                </Link>
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
