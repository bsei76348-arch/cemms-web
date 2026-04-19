import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Map, 
  BarChart3, 
  FileText, 
  Settings,
  Menu,
  X 
} from 'lucide-react'; // Assuming lucide-react icons, common in modern Next.js apps
import { useState } from 'react';

interface StaffSidebarProps {
  onClose?: () => void;
}

"use client";

export default function StaffSidebar({ onClose }: StaffSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const menuItems = [
    { href: '/staff', label: 'Dashboard', icon: Home, active: pathname === '/staff' },
    { href: '/staff/live-map', label: 'Live Map', icon: Map, active: pathname.startsWith('/staff/live-map') },
    { href: '/staff/live-stats', label: 'Live Stats', icon: BarChart3, active: pathname.startsWith('/staff/live-stats') },
    { href: '/staff/reports', label: 'Reports', icon: FileText, active: pathname.startsWith('/staff/reports') },
    { href: '/staff/settings', label: 'Settings', icon: Settings, active: pathname.startsWith('/staff/settings') },
  ];

  return (
    <>
      {/* Mobile overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-staff-bg text-staff-text z-50 transform transition-transform lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:w-20 lg:hover:w-64 lg:group-hover:w-64`}>
        
        {/* Mobile header */}
        <div className="lg:hidden p-4 border-b border-staff-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-staff-primary">Staff Panel</h2>
          <button onClick={toggleSidebar} className="lg:hidden">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Logo/Brand - narrow mode */}
        <div className="p-4 border-b border-staff-border lg:w-20">
          <div className="text-center">
            <div className="w-10 h-10 bg-staff-primary rounded-lg flex items-center justify-center mx-auto mb-2 lg:group-hover:mx-0">
              <Home size={20} />
            </div>
            <span className="font-bold text-sm lg:hidden lg:group-hover:block whitespace-nowrap overflow-hidden text-ellipsis">
              CEMMS Staff
            </span>
          </div>
        </div>

        {/* Menu */}
        <nav className="p-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center p-3 rounded-lg transition-colors group ${
                  item.active 
                    ? 'bg-staff-primary text-white shadow-lg' 
                    : 'text-staff-text hover:bg-staff-hover hover:text-staff-primary'
                }`}
                onClick={onClose}
              >
                <Icon size={20} className={`mr-3 flex-shrink-0 ${item.active ? 'text-white' : ''}`} />
                <span className="whitespace-nowrap overflow-hidden text-ellipsis lg:group-hover:block hidden">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
