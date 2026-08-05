export const palette = {
  primary: "#2196F3",
  primaryDark: "#0D47A1",
  light: "#90CAF9",
  lightest: "#E3F2FD",
} as const;

export type PaletteColor = keyof typeof palette;
