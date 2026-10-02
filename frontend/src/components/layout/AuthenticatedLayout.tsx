import { ReactNode, Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileTabBar } from './MobileTabBar';

/** Khung trang sau đăng nhập: sidebar + header + nội dung (route con qua Outlet); điện thoại có thanh điều hướng dưới. */
export function AuthenticatedLayout({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background md:ml-60 print:ml-0">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} />
        <main className="flex-1 p-4 pb-24 md:p-6 overflow-auto print:p-0 print:overflow-visible">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Đang tải...
              </div>
            }
          >
            {children ?? <Outlet />}
          </Suspense>
        </main>
      </div>
      <MobileTabBar onMenu={() => setMenuOpen(true)} />
    </div>
  );
}
