// The header of the board a destination opens onto.
//
// It used to take a bare emoji, chosen per page, while the sidebar rail drew
// the designer's icon for the very same destination — you tapped a drawn quest
// scroll and landed on a page headed 🎯. Naming the destination instead of the
// picture means the rail and the board read one entry in
// lib/nav-destinations.ts, and cannot disagree again.

import Image from "next/image";
import type { ReactNode } from "react";
import { navDestination } from "@/lib/nav-destinations";

export default function PageHeader({
  destination,
  icon,
  title,
  description,
  eyebrow,
  meta,
}: {
  /** Key from lib/nav-destinations.ts — supplies the drawn icon the nav uses. */
  destination?: string;
  /** Emoji, for a header that stands for no nav destination at all. */
  icon?: string;
  title: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
}) {
  const entry = destination ? navDestination(destination) : null;
  // Collection is the one destination the designer hasn't drawn. It falls back
  // to the same emoji the rail falls back to, not to a second, different one.
  const fallback = icon ?? entry?.icon ?? "";

  return (
    <header className="pm-page-header">
      <span className="pm-page-header-icon" role="img" aria-hidden="true">
        {entry?.art ? (
          <Image src={entry.art} alt="" width={34} height={34} className="pm-page-header-art" />
        ) : (
          fallback
        )}
      </span>
      <div className="pm-page-header-copy">
        {eyebrow && <p className="pm-page-eyebrow">{eyebrow}</p>}
        <h1 className="pm-heading pm-page-title">{title}</h1>
        {description && <span className="sr-only">{description}</span>}
        {meta && <div className="pm-page-meta">{meta}</div>}
      </div>
    </header>
  );
}
