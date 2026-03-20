const REM_BASE_PX = 14;

export function rem14(px: number): string {
  return `${px / REM_BASE_PX}rem`;
}
