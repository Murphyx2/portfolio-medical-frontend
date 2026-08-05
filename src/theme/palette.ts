export const palette = {
  primary: "#66BB6A",
  primaryDark: "#1B5E20",
  light: "#A5D6A7",
  lightest: "#E8F5E9",
} as const;

export type PaletteColor = keyof typeof palette;
