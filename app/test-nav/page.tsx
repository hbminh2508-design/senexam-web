'use client';
import FepnMobileNav from '@/components/FepnMobileNav';

export default function TestNav() {
  return (
    <div className="h-screen bg-gray-100">
      <FepnMobileNav
        activePage="dashboard"
        centerButton={{
          label: 'Scan',
          icon: <span>S</span>,
        }}
      />
    </div>
  );
}
