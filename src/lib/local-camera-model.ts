import * as tf from "@tensorflow/tfjs";

export const CAMERA_MODEL_URL = "/camera-ai-model/model.json";
export const CAMERA_METADATA_URL = "/camera-ai-model/metadata.json";
export const CAMERA_MODEL_LABELS = ["Safe Environment", "Foreign Environment"] as const;

let modelPromise: Promise<tf.LayersModel> | null = null;
let metadataPromise: Promise<{ imageSize?: number; labels?: string[] }> | null = null;

export function loadCameraModel() {
  modelPromise ??= tf.loadLayersModel(CAMERA_MODEL_URL);
  return modelPromise;
}

export function loadCameraModelMetadata() {
  metadataPromise ??= fetch(CAMERA_METADATA_URL).then(async (response) => {
    if (!response.ok) return { imageSize: 224, labels: [...CAMERA_MODEL_LABELS] };
    const metadata = await response.json();
    return {
      imageSize: typeof metadata.imageSize === "number" ? metadata.imageSize : 224,
      labels: Array.isArray(metadata.labels) && metadata.labels.length > 0 ? metadata.labels : [...CAMERA_MODEL_LABELS],
    };
  }).catch(() => ({ imageSize: 224, labels: [...CAMERA_MODEL_LABELS] }));
  return metadataPromise;
}

/** Local-only Teachable Machine inference. This classification is advisory
 * presentation and must never feed sensors, quests, XP, or hardware. */
export async function classifyCameraFrame(source: HTMLVideoElement | HTMLCanvasElement) {
  const [model, metadata] = await Promise.all([loadCameraModel(), loadCameraModelMetadata()]);
  const imageSize = Number.isFinite(metadata.imageSize ?? NaN) ? (metadata.imageSize as number) : 224;
  const labels = Array.isArray(metadata.labels) && metadata.labels.length > 0 ? metadata.labels : [...CAMERA_MODEL_LABELS];

  const probabilities = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(source);
    const resized = tf.image.resizeBilinear(pixels, [imageSize, imageSize]);
    const normalized = resized.toFloat().div(127.5).sub(1).expandDims(0);
    const prediction = model.predict(normalized) as tf.Tensor;
    return Array.from(prediction.dataSync());
  }) as number[];

  const safeRaw = Number(probabilities[0] ?? 0);
  const foreignRaw = Number(probabilities[1] ?? 0);
  const safeProbability = Number.isFinite(safeRaw) ? safeRaw : 0;
  const foreignProbability = Number.isFinite(foreignRaw) ? foreignRaw : 0;
  const bestIndex = foreignProbability > safeProbability ? 1 : 0;
  return {
    label: (labels[bestIndex] ?? CAMERA_MODEL_LABELS[bestIndex]) as typeof CAMERA_MODEL_LABELS[number],
    confidence: bestIndex === 1 ? foreignProbability : safeProbability,
    probabilities: [safeProbability, foreignProbability] as [number, number],
  };
}
