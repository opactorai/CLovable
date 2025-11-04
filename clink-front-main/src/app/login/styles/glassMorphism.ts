// Shared glass-morphism style constants
export const glassStyles = {
  backgroundColor: 'color-mix(in srgb, #bbbbbc 12%, transparent)',
  backdropFilter: 'blur(8px) saturate(150%)',
  WebkitBackdropFilter: 'blur(8px) saturate(150%)',
  boxShadow: `
    inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
    inset 1.8px 3px 0px -2px color-mix(in srgb, #fff 90%, transparent),
    inset -2px -2px 0px -2px color-mix(in srgb, #fff 80%, transparent),
    inset -3px -8px 1px -6px color-mix(in srgb, #fff 60%, transparent),
    inset -0.3px -1px 4px 0px color-mix(in srgb, #000 12%, transparent),
    inset -1.5px 2.5px 0px -2px color-mix(in srgb, #000 20%, transparent),
    inset 0px 3px 4px -2px color-mix(in srgb, #000 20%, transparent),
    inset 2px -6.5px 1px -4px color-mix(in srgb, #000 10%, transparent),
    0px 1px 5px 0px color-mix(in srgb, #000 10%, transparent),
    0px 6px 16px 0px color-mix(in srgb, #000 8%, transparent)
  `,
  border: '1px solid color-mix(in srgb, #fff 20%, transparent)',
  transition:
    'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1), transform 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
};

export const glassTabStyles = {
  backgroundColor: 'color-mix(in srgb, #bbbbbc 36%, transparent)',
  boxShadow: `
    inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
    inset 2px 1px 0px -1px color-mix(in srgb, #fff 90%, transparent),
    inset -1.5px -1px 0px -1px color-mix(in srgb, #fff 80%, transparent),
    inset -2px -6px 1px -5px color-mix(in srgb, #fff 60%, transparent),
    inset -1px 2px 3px -1px color-mix(in srgb, #000 20%, transparent),
    inset 0px -4px 1px -2px color-mix(in srgb, #000 10%, transparent),
    0px 3px 6px 0px color-mix(in srgb, #000 8%, transparent)
  `,
  transition: 'all 400ms cubic-bezier(1, 0, 0.4, 1)',
};
