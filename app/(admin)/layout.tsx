import AdminSidebar from '../lib/AdminSidebar';
import '../css/admin-theme.css'; // Admin theme

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-theme min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <AdminSidebar />
      
      {/* Main content */}
      <main className="flex-1 ml-0 lg:ml-20 p-6 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
