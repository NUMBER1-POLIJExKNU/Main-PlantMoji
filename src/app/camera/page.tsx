import CameraCapture from "@/components/camera-capture";
import PageHeader from "@/components/page-header";
import { getRequestLocale } from "@/lib/i18n-server";
import { CAMERA_COPY } from "./copy";

export const dynamic = "force-dynamic";

export default async function CameraPage() {
  const locale = await getRequestLocale();
  const copy = CAMERA_COPY[locale];
  return <main className="mx-auto w-full"><PageHeader icon="📷" title={copy.title} description={copy.description} /><div className="mx-auto w-full max-w-[720px]"><CameraCapture locale={locale} aiEnabled={Boolean(process.env.GEMINI_API_KEY)} /></div></main>;
}
