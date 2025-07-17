import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  HelpCircle
} from "lucide-react";

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [clientesCount, setClientesCount] = useState<number>(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/api/clientes')
      .then(res => res.json())
      .then(data => setClientesCount(data.length))
      .catch(() => setClientesCount(0));
  }, []);

  const menuItems = [
    { 
      name: "Dashboard", 
      icon: LayoutDashboard, 
      path: "/dashboard",
      badge: null
    },
    { 
      name: "Clientes", 
      icon: Users, 
      path: "/customers",
      badge: clientesCount > 0 ? clientesCount.toString() : null
    }
    // Removido o item Áudios
  ];

  const bottomMenuItems = [
    // Removido o item Configurações
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={`${collapsed ? 'w-16' : 'w-68'} h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">AuditaAI Unimed</h1>
                <p className="text-sm text-sidebar-foreground">Sistema de Auditoria Portes</p>      
              </div>
            </div>
          )}
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
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={`flex items-center py-2 rounded-lg transition-colors sidebar-item
              ${collapsed ? 'justify-center px-0 gap-0' : 'gap-3 px-3'}
              ${isActive(item.path)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
            `}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && (
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
            ${collapsed ? 'justify-center px-0' : 'justify-start px-3'}`}
        >
          <LogOut className={`h-4 w-4${collapsed ? '' : ' mr-3'}`} />
          {!collapsed && "Sair"}
        </Button>
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {bottomMenuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors sidebar-item ${
              isActive(item.path) 
                ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;