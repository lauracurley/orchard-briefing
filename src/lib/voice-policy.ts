// Deliberate release gate. Change only after an approved live-integration test plan.
// Environment variables alone cannot enable spending in this UX preview release.
export function liveVoiceEnabled(): boolean {
  return false;
}
