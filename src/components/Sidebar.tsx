import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  BarChart3,
  Volume2,
  Bell,
  HelpCircle,
  XCircle,
  AlertCircleIcon,
  ClipboardList,
  Menu
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Sidebar = ({ isOpen, onOpenChange }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const menuItems = [
    { 
      name: "Dashboard", 
      icon: LayoutDashboard, 
      path: "/dashboard",
      badge: null
    },
    { 
      name: "Auditoria clientes", 
      icon: Users, 
      path: "/auditoria",
      badge: null
    },
    { 
      name: "Compliance", 
      icon: ClipboardList, 
      path: "/compliance",
      badge: null
    }
  ];

  const bottomMenuItems = [
    // Removido o item Configurações
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    navigate('/login');
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Sync with parent component
  useEffect(() => {
    if (onOpenChange && isMobile) {
      onOpenChange(mobileOpen);
    }
  }, [mobileOpen, onOpenChange, isMobile]);

  useEffect(() => {
    if (isOpen !== undefined && isMobile) {
      setMobileOpen(isOpen);
    }
  }, [isOpen, isMobile]);

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {(!collapsed || isMobile) && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">Compliance Unimed</h1>
                <p className="text-sm text-sidebar-foreground"> Normativa ANS nº 593 </p>      
              </div>
            </div>
          )}
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 p-0 hover:bg-sidebar-accent"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 text-sidebar-foreground" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-sidebar-foreground" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={`flex items-center py-2 rounded-lg transition-colors sidebar-item
              ${(collapsed && !isMobile) ? 'justify-center px-0 gap-0' : 'gap-3 px-3'}
              ${isActive(item.path)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
            `}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {(!collapsed || isMobile) && (
              <>
                <span className="text-sm font-medium">{item.name}</span>
                {item.badge && (
                  <Badge 
                    variant="secondary" 
                    className="ml-auto text-xs h-5 bg-primary/10 text-primary"
                  >
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </NavLink>
        ))}
        
        {/* Botão de Sair logo abaixo do menu principal */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={`w-full mt-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center
            ${(collapsed && !isMobile) ? 'justify-center px-0' : 'justify-start px-3'}`}
        >
          <LogOut className={`h-4 w-4${(collapsed && !isMobile) ? '' : ' mr-3'}`} />
          {(!collapsed || isMobile) && "Sair"}
        </Button>
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {bottomMenuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors sidebar-item ${
              isActive(item.path) 
                ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {(!collapsed || isMobile) && <span className="text-sm font-medium">{item.name}</span>}
          </NavLink>
        ))}
      </div>
    </>
  );

  // Mobile version with Sheet
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-50 h-10 w-10 bg-background/80 backdrop-blur-sm border"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-68 p-0 bg-sidebar border-sidebar-border">
          <div className="h-full flex flex-col">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop version
  return (
    <div className={`${collapsed ? 'w-16' : 'w-68'} h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300`}>
      <SidebarContent />
    </div>
  );
};

export default Sidebar;