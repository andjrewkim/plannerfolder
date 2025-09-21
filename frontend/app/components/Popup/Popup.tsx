"use client";

import { useEffect, useState } from "react";

export default function Popup() {
  const [show, setShow] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const timer = setTimeout(() => {
      // DEV MODE: Comment out the next line to disable popup in production
      const DEV_MODE = false;
      
      if (DEV_MODE) {
        setShow(true);
        return;
      }
      
      const hasSeen = localStorage.getItem("popup_seen");
      const reminderTime = localStorage.getItem("popup_reminder_time");
      
      if (reminderTime) {
        const now = new Date().getTime();
        const reminderTimestamp = parseInt(reminderTime);
        const dayInMs = 24 * 60 * 60 * 1000;
        
        if (now < reminderTimestamp + dayInMs) {
          return;
        } else {
          localStorage.removeItem("popup_reminder_time");
        }
      }
      
      if (hasSeen !== "permanent") {
        setShow(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isClient]);

  const shareUrl = "https://fluxplanner.netlify.app/userlogin";

  // Confetti effect
  const createConfetti = () => {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
    const confettiContainer = document.createElement('div');
    confettiContainer.style.position = 'fixed';
    confettiContainer.style.top = '0';
    confettiContainer.style.left = '0';
    confettiContainer.style.width = '100%';
    confettiContainer.style.height = '100%';
    confettiContainer.style.pointerEvents = 'none';
    confettiContainer.style.zIndex = '10000';
    document.body.appendChild(confettiContainer);

    // Create multiple confetti pieces
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = Math.random() * 8 + 4;
      const startX = Math.random() * window.innerWidth;
      const duration = Math.random() * 2000 + 1000;
      const delay = Math.random() * 500;
      
      confetti.style.position = 'absolute';
      confetti.style.left = startX + 'px';
      confetti.style.top = '-10px';
      confetti.style.width = size + 'px';
      confetti.style.height = size + 'px';
      confetti.style.backgroundColor = color;
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      confetti.style.opacity = '0.9';
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      
      confettiContainer.appendChild(confetti);
      
      // Animate the confetti
      setTimeout(() => {
        confetti.animate([
          { 
            transform: `translateY(0px) rotate(0deg) scale(1)`, 
            opacity: 0.9 
          },
          { 
            transform: `translateY(${window.innerHeight + 100}px) rotate(${360 + Math.random() * 360}deg) scale(0.8)`, 
            opacity: 0 
          }
        ], {
          duration: duration,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
      }, delay);
    }

    // Clean up confetti after animation
    setTimeout(() => {
      document.body.removeChild(confettiContainer);
    }, 3000);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    setIsAnimating(true);
    createConfetti();
    
    // Small delay before showing thanks
    setTimeout(() => {
      setShowThanks(true);
    }, 300);
    
    setTimeout(() => {
      setShow(false);
      localStorage.setItem("popup_seen", "permanent");
    }, 4500);
  };

  const handleRemindLater = () => {
    const now = new Date().getTime();
    localStorage.setItem("popup_reminder_time", now.toString());
    setShow(false);
  };

  const handleDontShow = () => {
    localStorage.setItem("popup_seen", "permanent");
    setShow(false);
  };

  if (!show || !isClient) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999]" 
         style={{ backgroundColor: 'hsl(var(--background) / 0.80)' }}>
      <div className={`bg-card border border-border/30 rounded-lg p-6 w-full max-w-sm mx-4 shadow-lg transition-all duration-500 ${
        isAnimating ? 'scale-105 shadow-2xl' : 'scale-100'
      }`}>
        
        {showThanks ? (
          // Thank you message with animation
          <div className="text-center animate-fadeIn">
            <div className="mb-3 animate-bounce">
              <span className="text-4xl">🎉</span>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2 animate-slideUp">
              Thank you!
            </h3>
            <p className="text-sm text-muted-foreground animate-slideUp delay-100">
              Your support means the world to us
            </p>
          </div>
        ) : (
          // Main content
          <div className={`transition-all duration-300 ${isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Enjoying the planner?
              </h3>
              <p className="text-sm text-muted-foreground">
                Share it with a friend to help us keep building
              </p>
            </div>

            {/* URL Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 p-2 bg-muted rounded border-border/30">
                <span className="text-xs text-muted-foreground font-mono flex-1 truncate">
                  {shareUrl}
                </span>
                <button
                  onClick={handleCopyUrl}
                  className="p-1.5 hover:bg-muted/50 rounded flex-shrink-0 transition-all duration-200 hover:scale-110"
                  title="Copy link"
                >
                  {copied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-green-600 animate-pulse">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M4 16c-1.1 0-2-.9-2 2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleShare}
                disabled={isAnimating}
                className="w-full py-2 px-4 bg-muted/30 hover:bg-button/50 text-foreground/80 hover:text-foreground/100 rounded text-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 disabled:opacity-50"
              >
                {isAnimating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">🎉</span>
                    Sharing...
                  </span>
                ) : (
                  "I shared it!"
                )}
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={handleRemindLater}
                  disabled={isAnimating}
                  className="flex-1 py-1.5 px-3 text-xs text-muted-foreground bg-muted/0 hover:text-foreground/80 rounded transition-all duration-200 hover:bg-muted/10 disabled:opacity-50"
                >
                  Remind later
                </button>
                <button
                  onClick={handleDontShow}
                  disabled={isAnimating}
                  className="flex-1 py-1.5 px-3 text-xs text-muted-foreground bg-muted/0 hover:text-foreground/80 rounded transition-all duration-200 hover:bg-muted/10 disabled:opacity-50"
                >
                  Don't show again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }
        
        .animate-slideUp.delay-100 {
          animation-delay: 0.1s;
          opacity: 0;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}