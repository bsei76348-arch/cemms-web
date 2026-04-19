import StaffSidebar from '../lib/StaffSidebar';
import '../css/staff-theme.css'; // Staff theme

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="staff-theme min-h-screen flex bg-white">
      {/* Sidebar */}
      <StaffSidebar />
      
      {/* Main content */}
      <main className="flex-1 ml-0 lg:ml-20 p-6 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
