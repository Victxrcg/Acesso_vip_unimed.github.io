import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [navigate, location]);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'Dashboard';
      case '/customers':
        return 'Clientes';
      case '/audios':
        return 'Áudios';
      case '/reports':
        return 'Relatórios';
      case '/analytics':
        return 'Analytics';
      case '/settings':
        return 'Configurações';
      case '/compliance':
        return 'Compliance';
      case '/help':
        return 'Ajuda';
      default:
        return 'Compliance Unimed';
    }
  };

  return (
    <div className="h-screen bg-background flex">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}
      
      {/* Mobile Sidebar */}
      {isMobile && (
        <Sidebar 
          isOpen={sidebarOpen} 
          onOpenChange={setSidebarOpen}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile menu button is now part of the Sidebar component */}
            <h1 className={`text-xl font-semibold text-foreground truncate ${isMobile ? 'ml-14' : ''}`}>
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* User Menu */}
            <div className="flex items-center gap-2 md:gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <div className="text-sm font-medium">Admin</div>
                <div className="text-xs text-muted-foreground">Administrador</div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;