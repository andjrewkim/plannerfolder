// app/(landing)/[slug]/client.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect } from 'react';

interface PageData {
  title: string;
  description: string;
  h1: string;
  content: string;
  bullets: string[];
}

export default function LandingPageClient({ page }: { page: PageData }) {
  useEffect(() => {
    document.title = page.title;
    
    const updateMetaTag = (selector: string, attribute: string, value: string) => {
      let tag = document.querySelector(selector) as HTMLMetaElement;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute.includes(':') ? 'property' : 'name', attribute);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', value);
    };

    updateMetaTag('meta[name="description"]', 'description', page.description);
    updateMetaTag('meta[property="og:title"]', 'og:title', page.title);
    updateMetaTag('meta[property="og:description"]', 'og:description', page.description);
  }, [page]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .hero-section {
          position: relative;
          width: 100%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          overflow: hidden;
          font-family: Inter, system-ui, -apple-system, sans-serif;
        }

        .hero-background {
          position: absolute;
          inset: 0;
        }

        .hero-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to left, rgba(0,0,0,0.5), rgba(0,0,0,0) 40%);
          z-index: 1;
        }

        .hero-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
        }

        .hero-content {
          position: relative;
          width: 100%;
          z-index: 2;
          padding: 0;
          display: flex;
          justify-content: flex-end;
          align-items: stretch;
          min-height: 100vh;
        }

        .hero-sidebar {
          width: 100%;
          max-width: 500px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 2.5rem;
          backdrop-filter: blur(4px);
          background: rgba(0, 0, 0, 0.3);
          border-radius: 0;
          margin: 0;
          box-shadow: -20px 0 40px rgba(0, 0, 0, 0.3);
        }

        .hero-title {
          font-size: clamp(1.5rem, 4vw, 2.5rem);
          font-weight: 400;
          margin-bottom: 1.5rem;
          line-height: 1.2;
          color: #ffffff;
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 0.3s;
        }

        .hero-divider {
          width: 50px;
          height: 2px;
          background-color: #ff9557;
          margin-bottom: 1.5rem;
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 0.5s;
        }

        .hero-description {
          font-size: clamp(0.95rem, 2vw, 1.05rem);
          margin-bottom: 2rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 0.6s;
        }

        .features-title {
          font-size: clamp(1rem, 2vw, 1.1rem);
          font-weight: 600;
          margin-bottom: 1rem;
          color: #ffffff;
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 0.9s;
        }

        .features-list {
          font-size: clamp(0.9rem, 1.8vw, 0.95rem);
          line-height: 1.9;
          margin-bottom: 2rem;
          list-style-type: disc;
          padding-left: 1.2rem;
          color: rgba(255, 255, 255, 0.85);
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 1.2s;
        }

        .features-list li {
          margin-bottom: 0.5rem;
        }

        .cta-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #b6683aff 0%, #9f4116ff 100%);
          color: #ffffff;
          font-weight: 600;
          border-radius: 8px;
          text-decoration: none;
          font-size: clamp(0.95rem, 2vw, 1rem);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 1.5s;
          width: fit-content;
          transition: transform 0.2s, box-shadow 0.2s;
          text-align: center;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .seo-content {
          background: #fff;
          padding: 48px 20px;
        }

        .content-wrapper {
          max-width: 760px;
          margin: 0 auto;
        }

        .content-title {
          font-size: 32px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #1f2328;
          line-height: 1.25;
          letter-spacing: -0.5px;
        }

        .content-wrapper h2 {
          font-size: 24px;
          font-weight: 600;
          margin: 32px 0 16px 0;
          color: #1f2328;
          padding-bottom: 8px;
          border-bottom: 1px solid #d8dee4;
        }

        .content-wrapper h3 {
          font-size: 20px;
          font-weight: 600;
          margin: 24px 0 12px 0;
          color: #1f2328;
        }

        .content-wrapper p {
          margin: 0 0 16px 0;
          line-height: 1.6;
          font-size: 16px;
          color: #59636e;
        }

        .content-wrapper ul,
        .content-wrapper ol {
          margin: 0 0 16px 0;
          padding-left: 32px;
        }

        .content-wrapper li {
          margin: 4px 0;
          line-height: 1.6;
          color: #59636e;
        }

        .content-wrapper strong {
          font-weight: 600;
          color: #1f2328;
        }

        .content-wrapper a {
          color: #b6683aff;
          text-decoration: none;
        }

        .content-wrapper a:hover {
          text-decoration: underline;
        }

        .key-features {
          margin: 32px 0;
          padding: 16px;
          background: #f6f8fa;
          border: 1px solid #d8dee4;
          border-radius: 6px;
        }

        .key-features h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2328;
        }

        .key-features ul {
          margin: 0;
          padding-left: 24px;
          list-style-type: disc;
        }

        .key-features li {
          margin: 4px 0;
          color: #59636e;
        }

        .cta-section {
          margin: 48px 0 0 0;
          padding: 0;
          background: transparent;
          border: none;
          text-align: center;
        }

        .cta-button-large {
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #b6683aff 0%, #9f4116ff 100%);
          color: #ffffff !important;
          font-weight: 600;
          border-radius: 6px;
          text-decoration: none;
          font-size: 16px;
          text-align: center;
          border: none;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(182, 104, 58, 0.25);
        }

        .cta-button-large:hover {
          color: #ffffff !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(182, 104, 58, 0.35);
        }

        @media (max-width: 1024px) {
          .hero-sidebar {
            max-width: 450px;
            padding: 2rem;
          }
        }

        @media (max-width: 768px) {
          .hero-section {
            min-height: 100vh;
          }

          .hero-content {
            justify-content: center;
            align-items: center;
            padding: 1rem;
            min-height: 100vh;
          }

          .hero-sidebar {
            max-width: 100%;
            margin: 0;
            padding: 2rem 1.5rem;
            backdrop-filter: blur(8px);
            background: rgba(0, 0, 0, 0.75);
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          }

          .hero-gradient {
            background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6));
          }

          .seo-content {
            padding: 56px 20px;
          }

          .content-title {
            font-size: 32px;
          }

          .content-wrapper h2 {
            font-size: 24px;
            margin-top: 40px;
          }

          .content-wrapper h3 {
            font-size: 18px;
            margin-top: 28px;
          }

          .key-features {
            padding: 24px 20px;
          }

          .key-features ul {
            padding-left: 0;
          }

          .content-wrapper ul,
          .content-wrapper ol {
            padding-left: 24px;
          }

          .cta-section {
            padding: 32px 20px;
          }
        }

        @media (max-width: 640px) {
          .hero-sidebar {
            padding: 1.5rem 1.25rem;
            margin: 0.5rem;
          }

          .features-list {
            padding-left: 1rem;
          }

          .cta-button {
            width: 100%;
            text-align: center;
          }

          .cta-button-large {
            width: 100%;
            max-width: 300px;
          }

          .seo-content {
            padding: 48px 16px;
          }

          .content-title {
            font-size: 28px;
          }
        }

        @media (max-width: 480px) {
          .hero-sidebar {
            padding: 1.25rem 1rem;
            margin: 0.5rem;
          }

          .hero-content {
            padding: 0.5rem;
          }

          .seo-content {
            padding: 40px 16px;
          }

          .key-features {
            padding: 20px 16px;
          }

          .cta-section {
            padding: 28px 16px;
          }
        }

        @media (max-height: 500px) and (orientation: landscape) {
          .hero-section {
            min-height: auto;
          }

          .hero-content {
            min-height: auto;
            padding: 2rem 1rem;
          }

          .hero-sidebar {
            margin: 1rem;
            padding: 1.5rem;
          }

          .hero-title {
            margin-bottom: 1rem;
          }

          .hero-description {
            margin-bottom: 1rem;
          }

          .features-list {
            margin-bottom: 1rem;
          }

          .hero-divider {
            margin-bottom: 1rem;
          }
        }
      ` }} />

      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-gradient" />
          <img 
            src="/screenshots/screenshot.png" 
            alt="Homework tracker interface"
            className="hero-image"
          />
        </div>

        <div className="hero-content">
          <div className="hero-sidebar">
            <h1 className="hero-title">{page.h1}</h1>
            <div className="hero-divider" />
            <p className="hero-description">{page.description}</p>
            <div className="hero-divider" />
            
            <h2 className="features-title">Why Students Use This Tracker</h2>
            <ul className="features-list">
              {page.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>

            <a href="/userlogin" className="cta-button">
              Get Started
            </a>
          </div>
        </div>
      </section>

      <article className="seo-content">
        <div className="content-wrapper">
          <header>
            <h1 className="content-title">{page.title}</h1>
          </header>

          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {page.content}
          </ReactMarkdown>

          <section className="key-features">
            <h3>Key Features</h3>
            <ul>
              {page.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          </section>

          <div className="cta-section">
            <a href="/userlogin" className="cta-button-large">
              Start Tracking Your Homework Now
            </a>
          </div>
        </div>
      </article>
    </>
  );
}