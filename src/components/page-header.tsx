import type { ReactNode } from "react";

export default function PageHeader({
  icon,
  title,
  description,
  eyebrow,
  meta,
}: {
  icon: string;
  title: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
}) {
  return (
    <header className="pm-page-header">
      <span className="pm-page-header-icon" role="img" aria-hidden="true">
        {icon}
      </span>
      <div className="pm-page-header-copy">
        {eyebrow && <p className="pm-page-eyebrow">{eyebrow}</p>}
        <h1 className="pm-heading pm-page-title">{title}</h1>
        {description && <p className="pm-page-subtitle">{description}</p>}
        {meta && <div className="pm-page-meta">{meta}</div>}
      </div>
    </header>
  );
}
