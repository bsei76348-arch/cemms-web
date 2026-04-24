// app/page.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { 
  Leaf, BarChart3, Smartphone, Shield, Globe, Users, TrendingUp,
  LogIn, ArrowRight, Sparkles
} from 'lucide-react';

export default function Home() {
  useEffect(() => {
    // Scroll animation for fade-in elements
    const fadeElements = document.querySelectorAll('.fade-in');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });
    
    fadeElements.forEach(el => observer.observe(el));
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = anchor.getAttribute('href');
        if (!targetId || targetId === '#') return;
        const target = document.querySelector(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    
    return () => observer.disconnect();
  }, []);

  const features = [
    { icon: BarChart3, title: 'Real-time Analytics', description: 'Monitor carbon emissions with live dashboards, detailed reports, and predictive analytics.' },
    { icon: Smartphone, title: 'Seamless Integration', description: 'Sync data between mobile apps and web platforms. Work offline and sync when connected.' },
    { icon: Shield, title: 'Secure & Compliant', description: 'Role-based access control ensures data security while maintaining compliance.' },
    { icon: Globe, title: 'Global Impact', description: 'Contribute to UN Sustainable Development Goals through transparent reporting.' },
    { icon: Users, title: 'Team Collaboration', description: 'Enable multiple departments to contribute data with centralized oversight.' },
    { icon: TrendingUp, title: 'Progress Tracking', description: 'Set reduction targets, track progress, and celebrate milestones.' },
  ];

  return (
    <>
      {/* Subtle background pattern */}
      <div className="bg-pattern"></div>
      
      <div className="landing-container">
        {/* Header */}
        <header className="landing-header">
          <div className="logo">
            <div className="logo-icon floating">
              <Leaf size={28} />
            </div>
            <div>
              <div className="logo-text">CEMMS</div>
              <div className="logo-tagline">Green Initiative Program</div>
            </div>
          </div>
          <Link href="/login" className="login-btn">
            <LogIn size={16} /> Login
          </Link>
        </header>
        
        {/* Hero */}
        <section className="hero-section">
          <h1 className="fade-in">
            Sustainability Starts<br />
            With <span className="accent">Conscious</span> Tracking
          </h1>
          <p className="fade-in hero-description">
            A comprehensive platform to monitor, analyze, and reduce carbon footprint through intelligent tracking and actionable insights.
          </p>
          <div className="cta-buttons fade-in">
            <Link href="#features" className="primary-btn">
              Explore Features <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="secondary-btn">
              Access Dashboard
            </Link>
          </div>
        </section>
        
        {/* Features */}
        <section id="features" className="features-section">
          <h2 className="section-title">Why Choose CEMMS?</h2>
          <div className="features-grid">
            {features.map((feature, idx) => (
              <div key={idx} className="feature-card fade-in">
                <div className="feature-icon">
                  <feature.icon size={32} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
        
        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-logo">CEMMS</div>
          <p className="tagline">“Bridging technology with environmental responsibility for a sustainable tomorrow.”</p>
          <p className="copyright">
            &copy; 2024 Carbon Emission Tracker System. All rights reserved.<br />
            For authorized personnel only. v2.1
          </p>
          <div className="footer-badges">
            <span className="badge-green"><Leaf size={12} /> Green Initiative</span>
            <span className="badge-pink"><Sparkles size={12} /> Community Program</span>
          </div>
        </footer>
      </div>

      <style jsx>{`
        /* Override any global interference – scoped to this page */
        .landing-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
          z-index: 2;
        }
        
        .bg-pattern {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: radial-gradient(#14B89D 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.03;
          pointer-events: none;
          z-index: 0;
        }
        
        /* Header */
        .landing-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 28px 0;
          border-bottom: 2px solid #E9F5DB;
          margin-bottom: 48px;
          flex-wrap: wrap;
          gap: 20px;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #14B89D, #0F5C4B);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 6px 14px rgba(20,184,157,0.2);
        }
        .logo-text {
          font-size: 28px;
          font-weight: 800;
          color: #0F5C4B;
          line-height: 1.2;
        }
        .logo-tagline {
          font-size: 12px;
          font-weight: 500;
          color: #64748B;
        }
        .login-btn {
          background: #14B89D;
          color: white;
          padding: 10px 24px;
          border-radius: 40px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          border: 1px solid #9FE5D5;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .login-btn:hover {
          background: #0F5C4B;
          transform: translateY(-2px);
        }
        
        /* Hero */
        .hero-section {
          text-align: center;
          padding: 60px 0 80px;
        }
        h1 {
          font-size: 48px;
          font-weight: 800;
          color: #0F5C4B;
          line-height: 1.2;
          margin-bottom: 24px;
        }
        .accent {
          background: linear-gradient(135deg, #14B89D, #0F5C4B);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-description {
          font-size: 18px;
          color: #4B5563;
          max-width: 700px;
          margin: 0 auto 32px;
          line-height: 1.6;
        }
        .cta-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .primary-btn, .secondary-btn {
          padding: 12px 28px;
          border-radius: 44px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .primary-btn {
          background: #14B89D;
          color: white;
          border: 1px solid #9FE5D5;
        }
        .primary-btn:hover {
          background: #0F5C4B;
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(20,184,157,0.3);
        }
        .secondary-btn {
          background: white;
          color: #0F5C4B;
          border: 1px solid #C8E6C9;
        }
        .secondary-btn:hover {
          background: #E9F5DB;
          transform: translateY(-3px);
        }
        
        /* Features */
        .features-section {
          padding: 60px 0 80px;
        }
        .section-title {
          text-align: center;
          font-size: 36px;
          font-weight: 700;
          color: #0F5C4B;
          margin-bottom: 48px;
          position: relative;
        }
        .section-title:after {
          content: '';
          display: block;
          width: 80px;
          height: 4px;
          background: linear-gradient(90deg, #14B89D, #D4E8B3);
          margin: 16px auto 0;
          border-radius: 4px;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 32px;
        }
        .feature-card {
          background: white;
          border-radius: 28px;
          padding: 28px 24px;
          transition: all 0.3s ease;
          border: 1px solid #E9F5DB;
          text-align: center;
        }
        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 35px rgba(20,184,157,0.1);
          border-color: #D4E8B3;
        }
        .feature-icon {
          width: 64px;
          height: 64px;
          background: #E9F5DB;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: #14B89D;
          transition: all 0.2s;
        }
        .feature-card:hover .feature-icon {
          background: #14B89D;
          color: white;
        }
        .feature-card h3 {
          font-size: 20px;
          font-weight: 700;
          color: #166534;
          margin-bottom: 12px;
        }
        .feature-card p {
          color: #4B5563;
          line-height: 1.5;
          font-size: 14px;
        }
        
        /* Footer */
        .landing-footer {
          background: #F8FDF9;
          border-top: 2px solid #E9F5DB;
          margin-top: 40px;
          padding: 48px 0 32px;
          text-align: center;
        }
        .footer-logo {
          font-size: 28px;
          font-weight: 800;
          color: #0F5C4B;
          margin-bottom: 16px;
        }
        .tagline {
          color: #5A7C2E;
          font-size: 14px;
          font-style: italic;
          max-width: 500px;
          margin: 0 auto 24px;
        }
        .copyright {
          color: #94A3B8;
          font-size: 12px;
          margin-bottom: 16px;
        }
        .footer-badges {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 20px;
        }
        .badge-green, .badge-pink {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 14px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge-green {
          background: #DCFCE7;
          color: #166534;
        }
        .badge-pink {
          background: #FCE7F3;
          color: #9D174D;
        }
        
        /* Animations */
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .floating {
          animation: float 3s ease-in-out infinite;
        }
        .fade-in {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .fade-in.visible {
          opacity: 1;
          transform: translateY(0);
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .landing-container {
            padding: 0 20px;
          }
          h1 {
            font-size: 32px;
          }
          .hero-description {
            font-size: 16px;
          }
          .section-title {
            font-size: 28px;
          }
          .features-grid {
            grid-template-columns: 1fr;
          }
          .landing-header {
            flex-direction: column;
            text-align: center;
          }
          .logo {
            justify-content: center;
          }
        }
        @media (max-width: 480px) {
          .cta-buttons {
            flex-direction: column;
            align-items: stretch;
          }
          .primary-btn, .secondary-btn {
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}