"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Users, 
  Map, 
  BarChart3, 
  FileText, 
  Settings,
  Menu,
  X 
} from 'lucide-react';
import { useState } from 'react';

interface AdminSidebarProps {
  onClose?: () => void;
}

export default function AdminSidebar({ onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const menuItems = [
    { href: '/admin', label: 'Dashboard', icon: Home, active: pathname === '/admin' },
    { href: '/admin/users', label: 'Users', icon: Users, active: pathname.startsWith('/admin/users') },
    { href: '/admin/live-map', label: 'Live Map', icon: Map, active: pathname.startsWith('/admin/live-map') },
    { href: '/admin/live-stats', label: 'Live Stats', icon: BarChart3, active: pathname.startsWith('/admin/live-stats') },
    { href: '/admin/reports', label: 'Reports', icon: FileText, active: pathname.startsWith('/admin/reports') },
    { href: '/admin/settings', label: 'Settings', icon: Settings, active: pathname.startsWith('/admin/settings') },
  ];

  return (
    <>
      {/* Mobile overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-gray-800 text-gray-200 z-50 transform transition-transform lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:w-20 lg:hover:w-64 lg:group-hover:w-64`}>
        
        {/* Mobile header */}
        <div className="lg:hidden p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-blue-400">Admin Panel</h2>
          <button onClick={toggleSidebar} className="lg:hidden">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Logo/Brand */}
        <div className="p-4 border-b border-gray-700 lg:w-20">
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2 lg:group-hover:mx-0">
              <Home size={20} className="text-white" />
            </div>
            <span className="font-bold text-sm lg:hidden lg:group-hover:block whitespace-nowrap overflow-hidden text-ellipsis">
              CEMMS Admin
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
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'text-gray-200 hover:bg-gray-700 hover:text-white'
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

