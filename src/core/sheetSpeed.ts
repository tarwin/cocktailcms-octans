// ---------------------------------------------------------------------------
// Sheet animation speed. A per-device preference (localStorage), applied by
// setting Octans' --octans-sheet-in/out-duration tokens on :root. Sheets read
// those tokens each time they open, so a change takes effect on the next open.
// ---------------------------------------------------------------------------
import { ref } from 'vue'

export type SheetSpeed = 'instant' | 'fast' | 'normal' | 'slow'

export const SHEET_SPEEDS: Record<SheetSpeed, { label: string; in: number; out: number }> = {
  instant: { label: 'Instant', in: 0, out: 0 },
  fast: { label: 'Fast', in: 180, out: 140 },
  normal: { label: 'Normal', in: 320, out: 260 },
  slow: { label: 'Slow', in: 700, out: 700 }, // Octans' own default
}

const KEY = '_sheetSpeed'
const DEFAULT: SheetSpeed = 'fast'

function load(): SheetSpeed {
  try {
    const v = window.localStorage.getItem(KEY) as SheetSpeed | null
    if (v && v in SHEET_SPEEDS) return v
  } catch {
    /* storage may be blocked */
  }
  return DEFAULT
}

export const sheetSpeed = ref<SheetSpeed>(load())

function apply(speed: SheetSpeed) {
  const { in: inMs, out: outMs } = SHEET_SPEEDS[speed]
  const root = document.documentElement.style
  root.setProperty('--octans-sheet-in-duration', `${inMs}ms`)
  root.setProperty('--octans-sheet-out-duration', `${outMs}ms`)
}

export function initSheetSpeed() {
  apply(sheetSpeed.value)
}

export function setSheetSpeed(speed: SheetSpeed) {
  sheetSpeed.value = speed
  apply(speed)
  try {
    window.localStorage.setItem(KEY, speed)
  } catch {
    /* ignore */
  }
}
