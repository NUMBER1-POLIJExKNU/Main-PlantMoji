import * as tf from "@tensorflow/tfjs";

export const CAMERA_MODEL_URL = "/camera-ai-model/model.json";
export const CAMERA_MODEL_LABELS = ["Safe Environment", "Foreign Environment"] as const;

let modelPromise: Promise<tf.LayersModel> | null = null;

export function loadCameraModel() {
  modelPromise ??= tf.loadLayersModel(CAMERA_MODEL_URL);
  return modelPromise;
}

/** Local-only Teachable Machine inference. This classification is advisory
 * presentation and must never feed sensors, quests, XP, or hardware. */
export async function classifyCameraFrame(source: HTMLVideoElement | HTMLCanvasElement) {
  const model = await loadCameraModel();
  const probabilities = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(source);
    const resized = tf.image.resizeBilinear(pixels, [224, 224]);
    const normalized = resized.toFloat().div(127.5).sub(1).expandDims(0);
    const prediction = model.predict(normalized) as tf.Tensor;
    return Array.from(prediction.dataSync());
  });
  const bestIndex = probabilities[1] > probabilities[0] ? 1 : 0;
  return {
    label: CAMERA_MODEL_LABELS[bestIndex],
    confidence: Number.isFinite(probabilities[bestIndex]) ? probabilities[bestIndex] : 0,
    probabilities,
  };
}
