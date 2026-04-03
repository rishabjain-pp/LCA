import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      <SideNav />
      <div className="ml-64 flex-1 flex flex-col min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
