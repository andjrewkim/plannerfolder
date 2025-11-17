import type { Metadata } from 'next';
import { landingPages } from '../data/landingPages';

export async function generateStaticParams() {
  return Object.keys(landingPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = landingPages[slug as keyof typeof landingPages];
  if (!page) return { title: 'Page not found' };
  return {
    title: page.title,
    description: page.description,
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = landingPages[slug as keyof typeof landingPages];
  if (!page) return <div>Page not found</div>;

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
          {page.title}
        </h1>

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
          {page.description}
        </p>

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
          {page.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>

        {/* Call-to-action */}
        <a
          href="/userlogin"
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