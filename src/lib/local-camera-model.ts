import * as tf from "@tensorflow/tfjs";

export const CAMERA_MODEL_URL = "/camera-ai-model/model.json";
export const CAMERA_METADATA_URL = "/camera-ai-model/metadata.json";
export const CAMERA_MODEL_LABELS = ["Safe Environment", "Foreign Environment"] as const;
export type CameraModelLabel = (typeof CAMERA_MODEL_LABELS)[number];

/** What the shipped sidecar says today, and what we fall back to when it is
 * unreachable or says something we do not recognise. */
const DEFAULT_METADATA: { imageSize: number; labels: string[] } = {
  imageSize: 224,
  labels: [...CAMERA_MODEL_LABELS],
};

let modelPromise: Promise<tf.LayersModel> | null = null;
let metadataPromise: Promise<typeof DEFAULT_METADATA> | null = null;

export function loadCameraModel() {
  modelPromise ??= tf.loadLayersModel(CAMERA_MODEL_URL);
  return modelPromise;
}

export function loadCameraModelMetadata() {
  // Only a successful read is memoized. Caching the fallback would pin the
  // defaults for the rest of the session after a single offline blip — silent
  // and sticky the moment the sidecar stops agreeing with the constants.
  metadataPromise ??= fetch(CAMERA_METADATA_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`camera metadata ${response.status}`);
      const metadata = await response.json();
      const size: unknown = metadata?.imageSize;
      const labels: unknown = metadata?.labels;
      return {
        // A zero, negative or fractional size would make resizeBilinear throw
        // on every tick and wedge the classifier in its failed state.
        imageSize: typeof size === "number" && Number.isInteger(size) && size > 0 ? size : DEFAULT_METADATA.imageSize,
        labels: Array.isArray(labels) && labels.length > 0 ? (labels as string[]) : DEFAULT_METADATA.labels,
      };
    })
    .catch(() => {
      metadataPromise = null;
      return DEFAULT_METADATA;
    });
  return metadataPromise;
}

function finite(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Local-only Teachable Machine inference. This classification is advisory
 * presentation and must never feed sensors, quests, XP, or hardware. */
export async function classifyCameraFrame(source: HTMLVideoElement | HTMLCanvasElement) {
  const [model, metadata] = await Promise.all([loadCameraModel(), loadCameraModelMetadata()]);

  const raw = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(source);
    const resized = tf.image.resizeBilinear(pixels, [metadata.imageSize, metadata.imageSize]);
    const normalized = resized.toFloat().div(127.5).sub(1).expandDims(0);
    const prediction = model.predict(normalized) as tf.Tensor;
    return Array.from(prediction.dataSync());
  }) as number[];

  // The sidecar's label array is index-aligned with the output vector, so the
  // class ORDER is read from it rather than assumed — a re-train that creates
  // the classes the other way round would otherwise invert every reading. Class
  // NAMES we do not recognise fall back to the canonical order instead of being
  // cast into the union, where every downstream string comparison would miss
  // and a foreign detection would paint itself green.
  const safeIndex = metadata.labels.indexOf(CAMERA_MODEL_LABELS[0]);
  const foreignIndex = metadata.labels.indexOf(CAMERA_MODEL_LABELS[1]);
  const known = safeIndex >= 0 && foreignIndex >= 0;
  const safe = finite(raw[known ? safeIndex : 0]);
  const foreign = finite(raw[known ? foreignIndex : 1]);

  return {
    label: foreign > safe ? CAMERA_MODEL_LABELS[1] : CAMERA_MODEL_LABELS[0],
    confidence: Math.max(safe, foreign),
    probabilities: { safe, foreign },
  };
}
