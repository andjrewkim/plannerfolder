import React from 'react';
import { Grid3X3 } from 'lucide-react';

interface StripeToggleButtonProps {
  isActive: boolean;
  onToggle: () => void;
  className?: string;
}

const StripeToggleButton: React.FC<StripeToggleButtonProps> = ({
  isActive,
  onToggle,
  className = ''
}) => {
  return (
    <button
      onClick={onToggle}
      className={`stripe-toggle-btn ${isActive ? 'active' : ''} ${className}`}
      title={isActive ? 'Hide stripe pattern' : 'Mark class as no work'}
    >
      <Grid3X3 size={16} />
      
      <style jsx>{`
        .stripe-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          color: hsl(var(--muted-foreground));
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .stripe-toggle-btn:hover {
          background: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
          border-color: hsl(var(--accent-foreground) / 0.3);
        }

        .stripe-toggle-btn.active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
        }

        .stripe-toggle-btn.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            hsl(var(--primary-foreground) / 0.2) 2px,
            hsl(var(--primary-foreground) / 0.2) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        .stripe-toggle-btn.active > :global(*) {
          position: relative;
          z-index: 1;
        }

        .stripe-toggle-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </button>
  );
};

export default StripeToggleButton;