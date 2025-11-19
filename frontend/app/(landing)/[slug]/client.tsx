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
  // Set page metadata dynamically
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
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Hero Section */
        .hero-section {
          position: relative;
          width: 100%;
          height: 100vh;
          min-height: 600px;
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
          height: 100%;
          z-index: 2;
        }

        .hero-sidebar {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: 30%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 3rem;
          backdrop-filter: blur(4px);
          background: rgba(0, 0, 0, 0.1);
        }

        .hero-title {
          font-size: 2.5rem;
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
          font-size: 1.05rem;
          margin-bottom: 2.5rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 0.6s;
        }

        .features-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #ffffff;
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 0.9s;
        }

        .features-list {
          font-size: 0.95rem;
          line-height: 1.9;
          margin-bottom: 2.5rem;
          list-style-type: disc;
          padding-left: 1.2rem;
          color: rgba(255, 255, 255, 0.85);
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 1.2s;
        }

        .cta-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #b6683aff 0%, #9f4116ff 100%);
          color: #ffffff;
          font-weight: 600;
          border-radius: 8px;
          text-decoration: none;
          font-size: 1rem;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
          opacity: 0;
          animation: fadeInRight 1s forwards;
          animation-delay: 1.5s;
          width: fit-content;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        /* SEO Content Section */
        .seo-content {
          background: #ffffff;
          padding: 4rem 2rem;
        }

        .content-wrapper {
          max-width: 900px;
          margin: 0 auto;
          opacity: 0;
          animation: fadeInUp 1s forwards;
          animation-delay: 0.5s;
        }

        .content-title {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 2rem;
          color: #1a1a1a;
          line-height: 1.3;
        }

        .content-wrapper .content-h2 {
          font-size: 2rem;
          font-weight: 600;
          margin-top: 3rem;
          margin-bottom: 1rem;
          color: #2c2c2c;
          border-bottom: 2px solid #ff9557;
          padding-bottom: 0.5rem;
        }

        .content-wrapper .content-h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          color: #333333;
        }

        .content-wrapper .content-p {
          margin-bottom: 1.5rem;
          line-height: 1.8;
          font-size: 1.1rem;
          color: #444444;
        }

        .content-wrapper .content-ul,
        .content-wrapper .content-ol {
          margin-bottom: 1.5rem;
          padding-left: 2rem;
          line-height: 1.8;
        }

        .content-wrapper .content-ul {
          list-style-type: disc;
        }

        .content-wrapper .content-ol {
          list-style-type: decimal;
        }

        .content-wrapper .content-li {
          margin-bottom: 0.75rem;
          font-size: 1.05rem;
          color: #444444;
        }

        .content-wrapper .content-strong {
          font-weight: 700;
          color: #2c2c2c;
        }

        .content-wrapper .content-link {
          color: #b6683aff;
          text-decoration: underline;
        }

        .content-wrapper .content-link:hover {
          color: #9f4116ff;
        }

        .key-features {
          margin-top: 3rem;
          padding: 2rem;
          background: #f9fafb;
          border-radius: 12px;
          border-left: 4px solid #ff9557;
        }

        .key-features h3 {
          font-size: 1.75rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #2c2c2c;
        }

        .key-features ul {
          padding-left: 2rem;
          list-style-type: disc;
        }

        .key-features li {
          margin-bottom: 0.75rem;
          line-height: 1.7;
          font-size: 1.05rem;
          color: #444444;
        }

        .cta-section {
          margin-top: 4rem;
          text-align: center;
          padding: 3rem 0;
        }

        .cta-button-large {
          display: inline-block;
          padding: 1rem 2.5rem;
          background: linear-gradient(135deg, #b6683aff 0%, #9f4116ff 100%);
          color: #ffffff;
          font-weight: 600;
          border-radius: 12px;
          text-decoration: none;
          font-size: 1.2rem;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .cta-button-large:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        }

        /* Mobile Responsive */
        @media (max-width: 1024px) {
          .hero-sidebar {
            width: 45%;
            padding: 0 2rem;
          }

          .hero-title {
            font-size: 2rem;
          }
        }

        @media (max-width: 768px) {
          .hero-section {
            height: auto;
            min-height: 100vh;
          }

          .hero-sidebar {
            position: relative;
            width: 100%;
            padding: 2rem;
            backdrop-filter: blur(8px);
            background: rgba(0, 0, 0, 0.7);
          }

          .hero-title {
            font-size: 1.75rem;
          }

          .hero-description {
            font-size: 1rem;
          }

          .content-title {
            font-size: 2rem;
          }

          .content-wrapper .content-h2 {
            font-size: 1.5rem;
          }
        }
      ` }} />

      {/* Hero Section - Visible to both users and crawlers */}
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

      {/* Main SEO Content - Fully accessible */}
      <article className="seo-content">
        <div className="content-wrapper">
          <header>
            <h1 className="content-title">{page.title}</h1>
          </header>

          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({node, ...props}) => <h2 className="content-h2" {...props} />,
              h3: ({node, ...props}) => <h3 className="content-h3" {...props} />,
              p: ({node, ...props}) => <p className="content-p" {...props} />,
              ul: ({node, ...props}) => <ul className="content-ul" {...props} />,
              ol: ({node, ...props}) => <ol className="content-ol" {...props} />,
              li: ({node, ...props}) => <li className="content-li" {...props} />,
              strong: ({node, ...props}) => <strong className="content-strong" {...props} />,
              a: ({node, ...props}) => <a className="content-link" {...props} />,
            }}
          >
            {page.content}
          </ReactMarkdown>

          <section className="key-features">
            <h3>Key Features:</h3>
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