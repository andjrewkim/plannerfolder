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
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', sans-serif;
          line-height: 1.7;
          color: #2d3748;
          background: #ffffff;
          -webkit-font-smoothing: antialiased;
        }

        .article-container {
          max-width: 740px;
          margin: 0 auto;
          padding: 48px 24px 100px;
        }

        header {
          margin-bottom: 40px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
        }

        h1 {
          font-size: 34px;
          font-weight: 700;
          line-height: 1.25;
          color: #1a202c;
          margin-bottom: 16px;
          letter-spacing: -0.01em;
        }

        .subtitle {
          font-size: 19px;
          line-height: 1.6;
          color: #4a5568;
          margin-bottom: 20px;
        }

        .article-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: #718096;
          margin-top: 20px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .meta-divider {
          color: #cbd5e0;
        }

        article h2 {
          font-size: 26px;
          font-weight: 600;
          color: #1a202c;
          margin: 56px 0 20px 0;
          line-height: 1.3;
          letter-spacing: -0.01em;
        }

        article h3 {
          font-size: 21px;
          font-weight: 600;
          color: #2d3748;
          margin: 40px 0 16px 0;
          line-height: 1.4;
        }

        article p {
          margin: 0 0 22px 0;
          font-size: 17px;
          line-height: 1.75;
          color: #2d3748;
        }

        article ul,
        article ol {
          margin: 0 0 24px 0;
          padding-left: 28px;
        }

        article li {
          margin: 12px 0;
          line-height: 1.7;
          color: #2d3748;
          font-size: 17px;
        }

        article strong {
          font-weight: 600;
          color: #1a202c;
        }

        article a {
          color: #2563eb;
          text-decoration: none;
          border-bottom: 1px solid #bfdbfe;
          transition: border-color 0.2s;
        }

        article a:hover {
          border-bottom-color: #2563eb;
        }

        .stat-callout {
          background: #f0f9ff;
          border-left: 3px solid #0284c7;
          padding: 24px 28px;
          margin: 32px 0;
          font-size: 17px;
          line-height: 1.6;
        }

        .stat-callout p {
          margin: 0;
          color: #0c4a6e;
        }

        .research-note {
          background: #fefce8;
          border-left: 3px solid #ca8a04;
          padding: 24px 28px;
          margin: 32px 0;
        }

        .research-note p {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #713f12;
        }

        .research-note p:last-child {
          margin: 0;
        }

        .research-note strong {
          color: #713f12;
        }

        .practical-example {
          background: #f8fafc;
          border: 1px solid #cbd5e0;
          padding: 28px;
          margin: 32px 0;
        }

        .practical-example h4 {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 16px 0;
        }

        .practical-example p {
          margin: 0 0 14px 0;
          font-size: 16px;
          color: #475569;
        }

        .practical-example p:last-child {
          margin: 0;
        }

        .quick-summary {
          background: #f0fdf4;
          border: 1px solid #86efac;
          padding: 28px 32px;
          margin: 48px 0;
        }

        .quick-summary h3 {
          font-size: 19px;
          font-weight: 600;
          color: #166534;
          margin: 0 0 16px 0;
        }

        .quick-summary ul {
          margin: 0;
          padding-left: 24px;
        }

        .quick-summary li {
          color: #15803d;
          font-size: 16px;
          margin: 10px 0;
          line-height: 1.6;
        }

        .tool-mention {
          background: #fafafa;
          border-top: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          padding: 32px 28px;
          margin: 48px 0;
        }

        .tool-mention p {
          margin: 0 0 18px 0;
          font-size: 17px;
          color: #374151;
        }

        .tool-mention a {
          display: inline-block;
          padding: 11px 24px;
          background: #2563eb;
          color: #ffffff;
          font-weight: 500;
          font-size: 16px;
          text-decoration: none;
          border: none;
          transition: background 0.2s;
        }

        .tool-mention a:hover {
          background: #1d4ed8;
        }

        .comparison-table {
          overflow-x: auto;
          margin: 36px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 15px;
        }

        th, td {
          text-align: left;
          padding: 14px 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
          font-size: 15px;
        }

        td {
          color: #4b5563;
          line-height: 1.6;
        }

        tbody tr:hover {
          background: #f9fafb;
        }

        blockquote {
          margin: 36px 0;
          padding: 20px 28px;
          border-left: 3px solid #cbd5e0;
          background: #f9fafb;
          font-style: italic;
          color: #4b5563;
          font-size: 17px;
        }

        blockquote p {
          margin: 0;
        }

        .image-placeholder {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          padding: 48px 24px;
          margin: 36px 0;
          text-align: center;
          color: #6b7280;
          font-size: 15px;
        }

        .related-content {
          margin: 72px 0 0 0;
          padding: 36px 0 0 0;
          border-top: 2px solid #e5e7eb;
        }

        .related-content h3 {
          font-size: 21px;
          font-weight: 600;
          color: #1a202c;
          margin: 0 0 24px 0;
        }

        .related-content ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .related-content li {
          margin: 14px 0;
        }

        .related-content a {
          color: #2563eb;
          text-decoration: none;
          font-size: 17px;
          border: none;
          transition: color 0.2s;
        }

        .related-content a:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }

        .external-link {
          color: #059669;
          border-bottom-color: #a7f3d0;
        }

        .external-link:hover {
          border-bottom-color: #059669;
        }

        @media (max-width: 768px) {
          .article-container {
            padding: 36px 18px 80px;
          }

          h1 {
            font-size: 29px;
          }

          .subtitle {
            font-size: 18px;
          }

          article h2 {
            font-size: 24px;
            margin: 48px 0 18px 0;
          }

          article h3 {
            font-size: 20px;
            margin: 36px 0 14px 0;
          }

          article p,
          article li {
            font-size: 16px;
          }

          .stat-callout,
          .research-note,
          .practical-example,
          .tool-mention {
            padding: 20px 22px;
          }

          .article-meta {
            flex-wrap: wrap;
          }

          th, td {
            padding: 12px 10px;
            font-size: 14px;
          }
        }

        @media (max-width: 480px) {
          .article-container {
            padding: 28px 16px 70px;
          }

          h1 {
            font-size: 26px;
          }

          .subtitle {
            font-size: 17px;
          }
        }
      ` }} />

      <div className="article-container">
        <header>
          <h1>{page.h1}</h1>
          <p className="subtitle">{page.description}</p>
          <div className="article-meta">
            <span className="meta-item">By Student Success Team</span>
            <span className="meta-divider">•</span>
            <span className="meta-item">Updated December 2024</span>
            <span className="meta-divider">•</span>
            <span className="meta-item">9 min read</span>
          </div>
        </header>

        <article>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({node, ...props}) => {
                const isFirstH2 = node?.position?.start.line && node.position.start.line < 150;
                
                return (
                  <>
                    <h2 {...props} />
                    {isFirstH2 && (
                      <>
                        <div className="stat-callout">
                          <p>Research from Inside Higher Ed shows that <strong>over 40% of students</strong> say combining syllabi to organize deadlines would most improve their time management.</p>
                        </div>
                        <div className="tool-mention">
                          <p>That's exactly what a good assignment tracker does—it pulls everything into one place so you're not hunting through five different syllabi.</p>
                          <a href="/userlogin">Try our assignment tracker</a>
                        </div>
                      </>
                    )}
                  </>
                );
              }
            }}
          >
            {page.content}
          </ReactMarkdown>

          <div className="research-note">
            <p><strong>The Research Backs This Up:</strong></p>
            <p>Studies show nearly half of college students cite time management as their biggest academic challenge. A 2024 Kahoot report found 47% of students struggle with managing their time effectively.</p>
          </div>

          <div className="practical-example">
            <h4>Real Example: The Sunday Setup Method</h4>
            <p>Take 20 minutes every Sunday evening to review all your syllabi and upcoming deadlines. Enter them into your tracker, then look at the week ahead. This simple habit helps you spot conflicts early and plan accordingly.</p>
            <p>Students who use weekly planning methods like this report feeling significantly less overwhelmed during busy academic periods.</p>
          </div>

          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Pros</th>
                  <th>Cons</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Paper Planner</td>
                  <td>Tactile, no distractions</td>
                  <td>Easy to lose, can't access everywhere</td>
                </tr>
                <tr>
                  <td>Phone Notes</td>
                  <td>Always with you</td>
                  <td>Disorganized, no reminders</td>
                </tr>
                <tr>
                  <td>Digital Tracker</td>
                  <td>Accessible anywhere, automatic reminders</td>
                  <td>Requires device</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="quick-summary">
            <h3>Key Takeaways</h3>
            <ul>
              {page.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          </div>
        </article>

        <div className="related-content">
          <h3>Continue Reading</h3>
          <ul>
            <li><a href="#">The 168-Hour Planning Method for College Students</a></li>
            <li><a href="#">Why 52% of Students Submit Assignments Late (And How to Fix It)</a></li>
            <li><a href="#">Digital vs. Paper Planners: What the Research Actually Shows</a></li>
            <li><a href="#" className="external-link">Time Management Strategies from Dartmouth Academic Skills Center</a></li>
          </ul>
        </div>
      </div>
    </>
  );
}