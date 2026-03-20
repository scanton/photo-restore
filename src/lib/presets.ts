export const PRESETS = [
  {
    slug: "standard",
    name: "Standard Restore",
    description: "Remove scratches, fix fading, enhance clarity",
    prompt:
      "Restore this vintage photograph. Remove scratches, repair fading, and enhance clarity and detail while preserving the natural look and feel of the original image.",
    creditsCost: 1,
    sortOrder: 0,
  },
  {
    slug: "colorize",
    name: "Colorize",
    description: "Add natural color to black & white photos",
    prompt:
      "Colorize this black and white photograph with natural, realistic colors appropriate to the era it was taken. Also restore any fading, scratches, or damage while adding color.",
    creditsCost: 2,
    sortOrder: 1,
  },
  {
    slug: "enhance",
    name: "Deep Enhance",
    description: "Maximum quality restoration for severely damaged photos",
    prompt:
      "Apply maximum quality restoration to this severely damaged photograph. Repair tears, heavy scratches, significant fading, and water damage. Reconstruct missing details and enhance all fine details to the highest possible quality.",
    creditsCost: 2,
    sortOrder: 2,
  },
  {
    slug: "portrait",
    name: "Portrait Focus",
    description: "Specialized restoration for face detail and skin tones",
    prompt:
      "Restore this portrait photograph with special attention to facial detail and skin tones. Repair damage while preserving natural skin texture, expression, and the character of the subject's face.",
    creditsCost: 1,
    sortOrder: 3,
  },
] as const;

export type Preset = (typeof PRESETS)[number];
