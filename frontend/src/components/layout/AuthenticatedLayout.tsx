import { ReactNode, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/** Khung trang sau đăng nhập: sidebar + header + nội dung (route con qua Outlet). */
export function AuthenticatedLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background md:ml-60">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
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
    </div>
  );
}
