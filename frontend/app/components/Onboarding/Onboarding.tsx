import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'hover' | 'none';
  actionText?: string;
}

interface OnboardingProps {
  isVisible: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentView: 'your-new-view' | 'calendar';
  onViewChange: (view: 'your-new-view' | 'calendar') => void;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Assignment Planner!',
    description: 'Are you ready to stop stressing about class assignments? Let\'s take a quick tour to help you organize your tasks.',
    target: 'body',
    position: 'center'
  },
  {
    id: 'edit-class-button',
    title: 'Edit Class Names',
    description: 'You can change the default classes and class names to match your exact schedule.',
    target: '.edit-class-btn',
    position: 'right'
  },
  {
    id: 'main-grid',
    title: 'Assignment Grid',
    description: 'This grid shows your assignments for each class and day. You can create assignments for your classes throughout the week.',
    target: '.main-grid',
    position: 'left'
  },
  {
    id: 'add-assignment',
    title: 'Adding Assignments',
    description: 'Use this + button to add a new assignment.',
    target: '.today-cell .add-assignment-btn, .assignment-cell.today .add-assignment-btn, [data-today="true"] .add-assignment-btn',
    position: 'right'
  },
  {
    id: 'stripe-toggle',
    title: 'Mark No Work Days',
    description: 'Press to mark when there\'s no work for a class.',
    target: '.today-cell .no-work-toggle, .assignment-cell.today .no-work-toggle, [data-today="true"] .no-work-toggle',
    position: 'right'
  },

  {
    id: 'completion',
    title: 'You\'re All Set!',
    description: 'You now know the basics! Explore the features at your own pace.',
    target: 'body',
    position: 'center'
  }
];

const Onboarding: React.FC<OnboardingProps> = ({ 
  isVisible, 
  onComplete, 
  onSkip, 
  currentView, 
  onViewChange 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ 
    top: window.innerHeight / 2 - 100, 
    left: window.innerWidth / 2 - 160 
  });

  const currentStepData = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;
  const isFirstStep = currentStep === 0;

  // Handle view switching
  useEffect(() => {
    if (!isVisible) return;

    const step = onboardingSteps[currentStep];
    
    if ((step.id === 'planner-view' || 
         step.id === 'classes-sidebar' || 
         step.id === 'class-item' ||
         step.id === 'add-class-button' ||
         step.id === 'grid-header' ||
         step.id === 'main-grid' ||
         step.id === 'assignment-cell' ||
         step.id === 'add-assignment' ||
         step.id === 'assignment-item') && 
        currentView !== 'your-new-view') {
      onViewChange('your-new-view');
    }
  }, [currentStep, isVisible, currentView, onViewChange]);

  // Find element and position tooltip
  useEffect(() => {
    if (!isVisible) return;

    const step = onboardingSteps[currentStep];
    
    if (step.position === 'center') {
      setHighlightedElement(null);
      setTooltipPosition({ 
        top: window.innerHeight / 2 - 100, // Subtract half the tooltip height (approx)
        left: window.innerWidth / 2 - 160  // Subtract half the tooltip width
      });
      return;
    }

    const findElement = () => {
      const selectors = step.target.split(',').map(s => s.trim());
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setHighlightedElement(element);
            calculatePosition(element, step);
            return;
          }
        }
      }
      
      // Fallback to center if not found
      setHighlightedElement(null);
      setTooltipPosition({ 
        top: window.innerHeight / 2 - 100, // Subtract half the tooltip height (approx)
        left: window.innerWidth / 2 - 160  // Subtract half the tooltip width
      });
    };

    // Wait a bit for view changes to complete
    const timeoutId = setTimeout(findElement, 100);
    return () => clearTimeout(timeoutId);
  }, [currentStep, isVisible, currentView]);

  const calculatePosition = useCallback((element: Element, step: OnboardingStep) => {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const padding = 20;
    
    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = rect.top - tooltipHeight - 15;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + 15;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - 15;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + 15;
        break;
    }

    // Keep on screen - horizontal
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }

    // Keep on screen - vertical
    if (top < padding) {
      top = padding;
    } else if (top + tooltipHeight > window.innerHeight - padding) {
      top = window.innerHeight - tooltipHeight - padding;
    }

    setTooltipPosition({ top, left });
  }, []);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Simple overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        zIndex: 10000
      }} />
      
      {/* Element highlight */}
      {highlightedElement && (
        <div style={{
          position: 'fixed',
          top: highlightedElement.getBoundingClientRect().top - 4,
          left: highlightedElement.getBoundingClientRect().left - 4,
          width: highlightedElement.getBoundingClientRect().width + 8,
          height: highlightedElement.getBoundingClientRect().height + 8,
          zIndex: 10001,
          border: '3px solid #3b82f6',
          borderRadius: '8px',
          pointerEvents: 'none',
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)'
        }} />
      )}

      {/* Tooltip */}
      <div style={{
        position: 'fixed',
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        zIndex: 10002,
        backgroundColor: 'hsl(220, 12%, 14%)',
        color: 'hsl(220, 10%, 85%)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        padding: '24px',
        width: '320px',
        border: '1px solid hsla(210, 2%, 42%, 1.00)',
        transition: 'top 200ms ease-out, left 200ms ease-out'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            margin: '0', 
            color: 'hsl(220, 10%, 85%)',
            lineHeight: '1.3'
          }}>
            {currentStepData.title}
          </h3>
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'hsl(220, 10%, 55%)',
              padding: '4px'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        <p style={{ 
          fontSize: '14px', 
          color: 'hsl(220, 10%, 55%)', 
          margin: '0 0 24px 0',
          lineHeight: '1.5'
        }}>
          {currentStepData.description}
        </p>

        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {onboardingSteps.map((_, index) => (
            <div
              key={index}
              style={{
                height: '4px',
                flex: 1,
                backgroundColor: index <= currentStep ? 'hsl(217, 50%, 68%)' : 'hsl(220, 8%, 18%)',
                borderRadius: '2px',
                transition: 'background-color 300ms ease'
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: 'hsl(220, 10%, 55%)' }}>
            {currentStep + 1} of {onboardingSteps.length}
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid hsl(220, 10%, 55%)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'hsl(220, 10%, 55%)'
                }}
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            
            <button
              onClick={handleNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: 'hsl(217, 50%, 68%)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'white',
                fontWeight: '500'
              }}
            >
              {isLastStep ? (
                <>
                  <Check size={14} />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Skip option */}
        {!isLastStep && (
          <button
            onClick={onSkip}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '8px',
              background: 'none',
              border: 'none',
              color: 'hsl(220, 10%, 55%)',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            Skip tutorial
          </button>
        )}
      </div>
    </>
  );
};

export default Onboarding;