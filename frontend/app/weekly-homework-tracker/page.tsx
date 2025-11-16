import React from 'react';

export const metadata = {
  title: 'Free Online Homework Tracker for High School Students',
  description:
    'Stay organized with this free online homework tracker for high school students. Track assignments, class schedules, and exams with ease using our web app.',
};

export default function LandingPage() {
  const animationStyle = `
    @keyframes fadeInRight {
      from { opacity: 0; transform: translateX(30px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{animationStyle}</style>

      {/* Background image with gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to left, rgba(0,0,0,0.4), rgba(0,0,0,0) 40%),
            url(/screenshots/screenshot.png)
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }}
      />

      {/* Right sidebar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: '35%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 3rem',
          backdropFilter: 'blur(4px)',
          color: '#ffffff',
          zIndex: 1,
        }}
      >
        {/* Main heading */}
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: '600',
            marginBottom: '1.5rem',
            lineHeight: '1.2',
            color: '#ffffff',
            opacity: 0,
            animation: 'fadeInRight 1s forwards',
            animationDelay: '0.3s',
          }}
        >
          Free Online Homework Tracker for High School Students
        </h1>

        {/* Divider line */}
        <div
          style={{
            width: '50px',
            height: '2px',
            backgroundColor: '#ff9557',
            marginBottom: '1.5rem',
            opacity: 0,
            animation: 'fadeInRight 1s forwards',
            animationDelay: '0.5s',
          }}
        />

        {/* Intro paragraph */}
        <p
          style={{
            fontSize: '1.05rem',
            marginBottom: '2.5rem',
            lineHeight: '1.6',
            color: 'rgba(255, 255, 255, 0.85)',
            opacity: 0,
            animation: 'fadeInRight 1s forwards',
            animationDelay: '0.6s',
          }}
        >
          Stay on top of your weekly classes, assignments, and exams with this simple online homework tracker. Designed specifically for high school students who want a clean and effective way to manage their school tasks.
        </p>

        {/* Divider line */}
        <div
          style={{
            width: '50px',
            height: '2px',
            backgroundColor: '#ff9557',
            marginBottom: '1rem',
            opacity: 0,
            animation: 'fadeInRight 1s forwards',
            animationDelay: '0.8s',
          }}
        />

        {/* Features section */}
        <h2
          style={{
            fontSize: '1.1rem',
            fontWeight: '600',
            marginBottom: '1rem',
            color: '#ffffff',
            opacity: 0,
            animation: 'fadeInRight 1s forwards',
            animationDelay: '0.9s',
          }}
        >
          Why Students Use This Tracker
        </h2>
        <ul
          style={{
            fontSize: '0.95rem',
            lineHeight: '1.9',
            marginBottom: '2.5rem',
            listStyleType: 'disc',
            paddingLeft: '1.2rem',
            color: 'rgba(255, 255, 255, 0.8)',
            opacity: 0,
            animation: 'fadeInRight 1s forwards',
            animationDelay: '1.2s',
          }}
        >
          <li>Track all homework assignments in one place online</li>
          <li>Organize weekly class schedules easily</li>
          <li>Keep exam and project deadlines clearly visible</li>
          <li>Completely free and accessible from any device</li>
        </ul>

        {/* Call-to-action */}
        <a
          href="/userlogin"
          className="cta-button"
          style={{
            display: 'inline-block',
            padding: '0.55rem 1.2rem',
            background: 'linear-gradient(135deg, #b6683aff 0%, #9f4116ff 100%)',
            color: '#ffffff',
            fontWeight: '600',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.9rem',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            opacity: 0,
            animation: 'fadeInRight 1s forwards',
            animationDelay: '1.5s',
          }}
        >
          Get Started
        </a>
      </div>
    </main>
  );
}