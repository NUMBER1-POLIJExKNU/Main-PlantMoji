/** Node-RED sends the calibrated LDR output as a relative 0–100 percentage.
 * This is an operational classroom threshold, not PPFD, DLI, or agronomic
 * crop-light sufficiency. */
export const LIGHT_PERCENT_MIN = 0;
export const LIGHT_PERCENT_MAX = 100;
export const LIGHT_SUFFICIENT_PERCENT = 30;

export function hasSufficientLight(value: number) {
  return value >= LIGHT_SUFFICIENT_PERCENT;
}
