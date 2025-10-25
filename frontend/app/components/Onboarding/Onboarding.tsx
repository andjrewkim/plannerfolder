import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  requiresAction?: boolean;
  actionType?: 'click' | 'edit' | 'add-assignment' | 'type-assignment';
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
    title: 'Let\'s get you organized in 30 seconds',
    description: 'Stop juggling assignments in your head. Add your first class and task now and see what is due today.',
    target: 'body',
    position: 'center'
  },
  {
    id: 'edit-class-name',
    title: 'Click the edit button to rename this',
    description: 'Change "Class 1" to one of your actual classes. Click the pencil icon.',
    target: '.class-item:first-child',
    position: 'right',
    requiresAction: true,
    actionType: 'click'
  },
  {
    id: 'save-class-name',
    title: 'Type your class name and press Enter',
    description: 'Enter a real class you\'re taking - like "Biology" or "Calculus" - then hit Enter to save it.',
    target: '.class-name-edit-input',
    position: 'right',
    requiresAction: true,
    actionType: 'edit'
  },
  {
    id: 'add-assignment',
    title: 'Now add something you need to do',
    description: 'Click the + button to add an assignment actually due for your class. Ex: "submit essay," or "practice problems."',
    target: '.class-row:first-child .assignment-cell:nth-child(2)',
    position: 'right'
  },
  {
    id: 'done',
    title: 'That\'s it. You\'re ready.',
    description: 'Tip: Press Ctrl + D to bookmark or pin this page so you can find it quickly. Come back after class to check off your work.',
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

  // Handle view switching
  useEffect(() => {
    if (!isVisible) return;
    if (currentView !== 'your-new-view') {
      onViewChange('your-new-view');
    }
  }, [currentStep, isVisible, currentView, onViewChange]);

  // Set up action listeners
  useEffect(() => {
    if (!isVisible || !currentStepData.requiresAction) return;

    console.log('Setting up listeners for step:', currentStepData.id, 'actionType:', currentStepData.actionType);

    const handleAction = (e: Event) => {
      const target = e.target as HTMLElement;
      
      console.log('Event detected:', e.type, 'on', target);
      
      if (currentStepData.actionType === 'click') {
        // Check if edit button was clicked
        const isEditButton = target.classList.contains('edit-class-btn') || 
                             target.closest('.edit-class-btn') ||
                             target.tagName === 'svg' && target.closest('.edit-class-btn');
        if (isEditButton) {
          setTimeout(() => {
            setCurrentStep(prev => prev + 1);
          }, 300);
        }
      } else if (currentStepData.actionType === 'edit') {
        // ONLY for class name editing
        if (target.classList.contains('class-name-edit-input')) {
          if (e.type === 'blur') {
            const inputValue = (target as HTMLInputElement).value.trim();
            if (inputValue && inputValue !== 'Class 1') {
              setTimeout(() => {
                setCurrentStep(prev => prev + 1);
              }, 300);
            }
          }
        }
      } else if (currentStepData.actionType === 'type-assignment') {
        // For assignment input ONLY
        console.log('Type assignment event:', e.type, 'target:', target);
        console.log('Target classes:', target.className);
        console.log('Target tag:', target.tagName);
        console.log('Is input?', target.tagName === 'INPUT');
        console.log('Input type:', target.getAttribute('type'));
        
        const isAssignmentInput = target.tagName === 'INPUT' && 
                                   !target.classList.contains('class-name-edit-input');
        
        console.log('Is assignment input?', isAssignmentInput);
        
        if (isAssignmentInput) {
          if ((e.type === 'keydown' || e.type === 'keypress') && (e as KeyboardEvent).key === 'Enter') {
            const inputValue = (target as HTMLInputElement).value.trim();
            console.log('Assignment input value:', inputValue);
            if (inputValue) {
              console.log('Advancing to next step!');
              // Wait a bit longer to ensure the assignment was created
              setTimeout(() => {
                setCurrentStep(prev => prev + 1);
              }, 800);
            }
          }
        }
      }
    };

    // Listen for appropriate events based on action type
    if (currentStepData.actionType === 'edit') {
      document.addEventListener('blur', handleAction, true);
    } else if (currentStepData.actionType === 'type-assignment') {
      // Use capture phase to catch before other handlers
      document.addEventListener('keydown', handleAction, { capture: true });
      document.addEventListener('keypress', handleAction, { capture: true });
      console.log('Added keydown and keypress listeners for type-assignment');
    } else {
      document.addEventListener('click', handleAction, true);
    }

    return () => {
      document.removeEventListener('click', handleAction, true);
      document.removeEventListener('keydown', handleAction, true);
      document.removeEventListener('keypress', handleAction, true);
      document.removeEventListener('blur', handleAction, true);
    };
  }, [currentStep, isVisible, currentStepData]);

  // Find element and position tooltip
  useEffect(() => {
    if (!isVisible) return;

    const step = onboardingSteps[currentStep];
    
    if (step.position === 'center') {
      setHighlightedElement(null);
      setTooltipPosition({ 
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160
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
      
      setHighlightedElement(null);
      setTooltipPosition({ 
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160
      });
    };

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

    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }

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

  if (!isVisible) return null;

  const rect = highlightedElement?.getBoundingClientRect();

  return (
    <>
      {/* Simple overlay when center positioned */}
      {currentStepData.position === 'center' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          zIndex: 10000,
          pointerEvents: 'auto'
        }} />
      )}
      
      {/* Element highlight - with higher z-index to appear above overlay */}
      {highlightedElement && rect && (
        <div style={{
          position: 'fixed',
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          zIndex: 10001,
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          pointerEvents: 'none',
          boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)'
        }} />
      )}

      {/* Tooltip */}
      <div style={{
        position: 'fixed',
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        zIndex: 10003,
        backgroundColor: 'hsl(220, 12%, 14%)',
        color: 'hsl(220, 10%, 85%)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        padding: '24px',
        width: '320px',
        border: '1px solid hsla(0, 0%, 26%, 1.00)',
        transition: 'top 200ms ease-out, left 200ms ease-out',
        pointerEvents: 'auto'
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
              padding: '4px',
              zIndex: 1
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
            {currentStepData.requiresAction ? (
              <div style={{
                padding: '8px 16px',
                backgroundColor: 'hsla(217, 34%, 48%, 0.3)',
                border: '1px solid hsla(217, 34%, 48%, 0.5)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'hsl(217, 50%, 68%)',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>


                Waiting...
              </div>
            ) : (
              <button
                onClick={handleNext}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: 'hsla(217, 34%, 48%, 1.00)',
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
                    Got it
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            )}
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

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(0.95);
          }
        }
      `}</style>
    </>
  );
};

export default Onboarding;