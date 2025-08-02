// Calendar utility functions

export function hexToHSL(hex: string) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h = h * 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Sort events by start time before rendering
export const sortEventsByTime = <T extends { start: string }>(events: T[]): T[] => {
  return [...events].sort((a, b) => {
    const aStart = new Date(a.start).getTime();
    const bStart = new Date(b.start).getTime();
    return aStart - bStart;
  });
};

// Time formatting utilities
export const formatTime = (date: Date, showMinutes: boolean = true) => {
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
  
  if (!showMinutes) {
    // Remove :00 from times like "12:00 PM" -> "12 PM"
    return timeStr.replace(':00', '');
  }
  
  return timeStr;
};

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Event styling function
export const applyEventStyling = (element: HTMLElement, eventColor: string) => {
  const hsl = hexToHSL(eventColor);
  
  // Create dynamic background with tinting
  const lightness = Math.max(15, Math.min(85, hsl.l));
  const saturation = Math.max(30, Math.min(90, hsl.s));
  
  // Base tinted background
  const baseColor = `hsla(${hsl.h}, ${saturation}%, ${lightness}%, 0.15)`;
  const borderColor = `hsla(${hsl.h}, ${saturation}%, ${Math.max(20, lightness - 20)}%, 0.3)`;
  const textColor = `hsla(${hsl.h}, ${Math.min(100, saturation + 10)}%, ${lightness > 50 ? 25 : 85}%, 0.95)`;
  
  // Apply the styling
  element.style.background = `
    linear-gradient(135deg, 
      hsla(${hsl.h}, ${saturation}%, ${Math.min(95, lightness + 15)}%, 0.2) 0%,
      ${baseColor} 40%,
      hsla(${hsl.h}, ${saturation}%, ${Math.max(10, lightness - 10)}%, 0.18) 100%
    )
  `;
  
  element.style.border = `1px solid ${borderColor}`;
  element.style.color = textColor;
  
  // Add a subtle border glow
  element.style.boxShadow = `
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.05),
    inset 0 1px 1px rgba(255, 255, 255, 0.1),
    0 0 0 1px hsla(${hsl.h}, ${saturation}%, ${lightness}%, 0.1)
  `;
  
  // Set CSS custom properties for hover effects
  element.style.setProperty('--hover-bg', `hsla(${hsl.h}, ${saturation}%, ${Math.min(95, lightness + 20)}%, 0.25)`);
  element.style.setProperty('--hover-border', `hsla(${hsl.h}, ${saturation}%, ${Math.max(20, lightness - 15)}%, 0.4)`);
  element.style.setProperty('--text-color', textColor);
  
  return { hsl, lightness, saturation, baseColor, borderColor, textColor };
};

// Add hover effects
export const addEventHoverEffects = (element: HTMLElement, hsl: any, saturation: number, lightness: number, baseColor: string, borderColor: string) => {
  const addHoverEffect = () => {
    element.style.background = `
      linear-gradient(135deg, 
        hsla(${hsl.h}, ${saturation}%, ${Math.min(98, lightness + 25)}%, 0.28) 0%,
        hsla(${hsl.h}, ${saturation}%, ${Math.min(90, lightness + 10)}%, 0.22) 40%,
        hsla(${hsl.h}, ${saturation}%, ${Math.max(5, lightness - 5)}%, 0.25) 100%
      )
    `;
    element.style.border = `1px solid hsla(${hsl.h}, ${saturation}%, ${Math.max(20, lightness - 15)}%, 0.4)`;
    element.style.boxShadow = `
      0 8px 20px rgba(0, 0, 0, 0.12),
      0 4px 8px rgba(0, 0, 0, 0.08),
      inset 0 1px 2px rgba(255, 255, 255, 0.15),
      0 0 0 1px hsla(${hsl.h}, ${saturation}%, ${lightness}%, 0.15)
    `;
  };
  
  const removeHoverEffect = () => {
    element.style.background = `
      linear-gradient(135deg, 
        hsla(${hsl.h}, ${saturation}%, ${Math.min(95, lightness + 15)}%, 0.2) 0%,
        ${baseColor} 40%,
        hsla(${hsl.h}, ${saturation}%, ${Math.max(10, lightness - 10)}%, 0.18) 100%
      )
    `;
    element.style.border = `1px solid ${borderColor}`;
    element.style.boxShadow = `
      0 4px 12px rgba(0, 0, 0, 0.08),
      0 2px 4px rgba(0, 0, 0, 0.05),
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      0 0 0 1px hsla(${hsl.h}, ${saturation}%, ${lightness}%, 0.1)
    `;
  };
  
  element.addEventListener('mouseenter', addHoverEffect);
  element.addEventListener('mouseleave', removeHoverEffect);
  
  return { addHoverEffect, removeHoverEffect };
};