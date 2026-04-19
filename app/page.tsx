'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Smartphone, 
  Lock, 
  Globe, 
  Handshake, 
  TrendingUp,
  Leaf,
  Heart 
} from 'lucide-react';

export default function Home() {
  useEffect(() => {
    // Scroll animation
    const fadeElements = document.querySelectorAll('.fade-in');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    fadeElements.forEach(element => {
      observer.observe(element);
    });
    
    // Smooth scrolling for anchor links - FIXED
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = anchor.getAttribute('href');
        if (!targetId || targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          const element = targetElement as HTMLElement;
          window.scrollTo({
            top: element.offsetTop - 100,
            behavior: 'smooth'
          });
        }
      });
    });
    
    // Add floating animation to feature cards on hover - FIXED
    document.querySelectorAll('.feature-card').forEach(card => {
      card.addEventListener('mouseenter', (event) => {
        (event.currentTarget as HTMLElement).style.animation = 'float 2s ease-in-out infinite';
      });
      
      card.addEventListener('mouseleave', (event) => {
        (event.currentTarget as HTMLElement).style.animation = 'none';
      });
    });
  }, []); // <--- ISA LANG 'TO dapat!
  
  return (
    <>
      {/* Decorative Leaves */}
      <div className="leaf-decoration leaf-1"><Leaf className="w-12 h-12 text-green-400 opacity-30" /></div>
      <div className="leaf-decoration leaf-2"><Leaf className="w-10 h-10 text-green-500 opacity-20" /></div>
      
      <div className="container">
        {/* HEADER */}
        <header>
          <div className="logo">
            <div className="logo-icon floating"><Leaf className="w-12 h-12 text-green-500" /></div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 800 }}>CEMMS</div>
              <div style={{ fontSize: '14px', fontWeight: 400, color: '#FF69B4' }}>Green Initiative Program</div>
            </div>
          </div>
          <Link href="/login" className="login-btn">Staff Login →</Link>
        </header>
        
        {/* HERO SECTION */}
        <section className="hero">
          <h1 className="fade-in">
            Sustainability Starts<br />
            With <span style={{ color: '#FF69B4' }}>Conscious</span> Tracking
          </h1>
          <p className="fade-in">
            A comprehensive platform for organizations to monitor, analyze, and reduce their carbon footprint through intelligent tracking and actionable insights.
          </p>
          
          <div className="cta-buttons fade-in">
            <Link href="#features" className="primary-btn">Explore Features</Link>
            <Link href="/login" className="secondary-btn">Access Dashboard</Link>
          </div>
        </section>
        
        {/* FEATURES SECTION */}
        <section id="features" className="features">
          <h2 className="section-title">Why Choose CEMMS?</h2>
          
          <div className="features-grid">
            <div className="feature-card fade-in">
              <div className="feature-icon"><Activity size={48} className="mx-auto mb-3 text-blue-500 opacity-90" /></div>
              <h3>Real-time Analytics</h3>
              <p>Monitor carbon emissions with live dashboards, detailed reports, and predictive analytics to make informed environmental decisions.</p>
            </div>
            
            <div className="feature-card fade-in">
              <div className="feature-icon"><Smartphone size={48} className="mx-auto mb-3 text-green-500 opacity-90" /></div>
              <h3>Seamless Integration</h3>
              <p>Sync data between mobile apps and web platforms effortlessly. Work offline and sync when connected.</p>
            </div>
            
            <div className="feature-card fade-in">
              <div className="feature-icon"><Lock size={48} className="mx-auto mb-3 text-purple-500 opacity-90" /></div>
              <h3>Secure & Compliant</h3>
              <p>Role-based access control ensures data security while maintaining compliance with environmental regulations.</p>
            </div>
            
            <div className="feature-card fade-in">
              <div className="feature-icon"><Globe size={48} className="mx-auto mb-3 text-blue-600 opacity-90" /></div>
              <h3>Global Impact</h3>
              <p>Join organizations worldwide in contributing to UN Sustainable Development Goals through transparent reporting.</p>
            </div>
            
            <div className="feature-card fade-in">
              <div className="feature-icon"><Handshake size={48} className="mx-auto mb-3 text-orange-500 opacity-90" /></div>
              <h3>Team Collaboration</h3>
              <p>Enable multiple departments to contribute data while maintaining centralized control and oversight.</p>
            </div>
            
            <div className="feature-card fade-in">
              <div className="feature-icon"><TrendingUp size={48} className="mx-auto mb-3 text-emerald-500 opacity-90" /></div>
              <h3>Progress Tracking</h3>
              <p>Set reduction targets, track progress, and celebrate milestones with visual progress indicators.</p>
            </div>
          </div>
        </section>
        
        {/* FOOTER */}
        <footer>
          <div className="footer-content">
            <div className="footer-logo">CEMMS</div>
            <p className="tagline">"Bridging technology with environmental responsibility for a sustainable tomorrow."</p>
            <p className="copyright">
              &copy; 2024 Carbon Emission Tracker System. All rights reserved.<br />
              For authorized personnel only. v2.1
            </p>
            <p style={{ marginTop: '20px', fontSize: '0.8rem', opacity: 0.6 }}>
              <span style={{ color: '#2E8B57' }}><Leaf className="w-4 h-4 inline -mb-1 mr-1" /> Green Initiative</span> | 
              <span style={{ color: '#FF69B4' }}><Heart className="w-4 h-4 inline -mb-1 mr-1" /> Community Program</span>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
