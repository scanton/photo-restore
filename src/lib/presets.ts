export const PRESETS = [
  {
    slug: "standard",
    name: "Standard Restore",
    description: "Remove scratches, fix fading, enhance clarity",
    creditsCost: 1,
    sortOrder: 0,
  },
  {
    slug: "colorize",
    name: "Colorize",
    description: "Add natural color to black & white photos",
    creditsCost: 2,
    sortOrder: 1,
  },
  {
    slug: "enhance",
    name: "Deep Enhance",
    description: "Maximum quality restoration for severely damaged photos",
    creditsCost: 2,
    sortOrder: 2,
  },
  {
    slug: "portrait",
    name: "Portrait Focus",
    description: "Specialized restoration for face detail and skin tones",
    creditsCost: 1,
    sortOrder: 3,
  },
] as const;

export type Preset = (typeof PRESETS)[number];
