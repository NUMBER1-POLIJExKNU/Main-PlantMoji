import Image from "next/image";
import { navDestination } from "@/lib/nav-destinations";

/** One renderer for a destination everywhere it is pictured. The navigation
 * rail and the page introduction both call this component, so an icon update
 * cannot land in one surface without the other. */
export default function DestinationIcon({
  destination,
  className,
  size,
}: {
  destination: string;
  className: string;
  size: number;
}) {
  const entry = navDestination(destination);
  if (!entry) return null;
  return entry.art ? (
    <Image src={entry.art} alt="" className={className} width={size} height={size} />
  ) : (
    entry.icon
  );
}
