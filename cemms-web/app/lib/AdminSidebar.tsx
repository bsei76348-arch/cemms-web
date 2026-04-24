'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Map, 
  TrendingUp, 
  FileText, 
  Users, 
  Settings, 
  LogOut,
  Leaf,
  Archive
} from 'lucide-react';

interface AdminSidebarProps {
  userName: string;
  onLogout: () => void;
}

export default function AdminSidebar({ userName, onLogout }: AdminSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
    { href: '/admin/records', icon: <Archive className="w-5 h-5" />, label: 'Records' },
    { href: '/admin/live-map', icon: <Map className="w-5 h-5" />, label: 'Emission Map' },
    { href: '/admin/live-stats', icon: <TrendingUp className="w-5 h-5" />, label: 'Analytics' },
    { href: '/admin/reports', icon: <FileText className="w-5 h-5" />, label: 'Reports' },
    { href: '/admin/users', icon: <Users className="w-5 h-5" />, label: 'Users' },
    { href: '/admin/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
  ];

  return (
    <div style={{
      width: '280px',
      background: 'white',
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #C8E6C9',
      boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
      zIndex: 100,
      padding: '28px 20px'
    }}>
      {/* Logo – Teal gradient */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          background: 'linear-gradient(135deg, #14B89D, #0F5C4B)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          <Leaf className="w-6 h-6" />
        </div>
        <div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0F5C4B' }}>CEMMS</div>
          <div style={{ fontSize: '11px', color: '#6B7280' }}>Admin Portal</div>
        </div>
      </div>

      {/* User Card – Light Teal background */}
      <div style={{
        background: '#E6F7F3',
        borderRadius: '20px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '32px',
        border: '1px solid #9FE5D5'
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          background: 'linear-gradient(135deg, #14B89D, #0F5C4B)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: '600',
          color: 'white',
          position: 'relative'
        }}>
          {userName ? userName.charAt(0).toUpperCase() : 'A'}
          <span style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            width: '12px',
            height: '12px',
            background: '#10B981',
            borderRadius: '50%',
            border: '2px solid white'
          }}></span>
        </div>
        <div>
          <div style={{ fontWeight: '700', color: '#0F5C4B', fontSize: '14px' }}>{userName}</div>
          <div style={{ fontSize: '11px', color: '#3B7A6A' }}>Administrator</div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', marginBottom: '16px', paddingLeft: '12px', letterSpacing: '0.5px' }}>
          MAIN MENU
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 16px',
                borderRadius: '14px',
                background: pathname === item.href ? '#14B89D' : 'transparent',
                color: pathname === item.href ? 'white' : '#4B5563',
                fontWeight: pathname === item.href ? '600' : '400',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (pathname !== item.href) {
                  e.currentTarget.style.backgroundColor = '#E9F5DB';
                  e.currentTarget.style.color = '#3D5C1A';
                }
              }}
              onMouseLeave={(e) => {
                if (pathname !== item.href) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#4B5563';
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            flex: 1,
            background: '#F9FAFB',
            padding: '12px 8px',
            borderRadius: '16px',
            textAlign: 'center',
            border: '1px solid #E5E7EB'
          }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F5C4B' }}>16</div>
            <div style={{ fontSize: '10px', color: '#6B7280' }}>Barangays</div>
          </div>
          <div style={{
            flex: 1,
            background: '#F9FAFB',
            padding: '12px 8px',
            borderRadius: '16px',
            textAlign: 'center',
            border: '1px solid #E5E7EB'
          }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F5C4B' }}>Live</div>
            <div style={{ fontSize: '10px', color: '#6B7280' }}>Data</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '12px',
            background: '#FEF2F2',
            border: '1px solid #FEE2E2',
            borderRadius: '14px',
            color: '#DC2626',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '16px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#FEE2E2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#FEF2F2';
          }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#9CA3AF' }}>CEMMS v2.0</div>
      </div>
    </div>
  );
}