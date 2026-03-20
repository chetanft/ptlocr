const REM_BASE_PX = 16;

/** Convert px to rem based on 16px root */
export function rem(px: number): string {
  return `${px / REM_BASE_PX}rem`;
}

/** @deprecated Use rem() instead. Kept for backward compatibility. */
export const rem14 = rem;
