import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuthStore } from "@/hooks/use-auth";
import { 
  Map, Car, Bell, User, LogOut, Store, LayoutDashboard, 
  MapPin, PackageSearch, Settings, Receipt 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuthStore();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const userNav = [
    { name: "الرحلات", href: "/user/trips", icon: Map },
    { name: "المركبات", href: "/user/vehicles", icon: Car },
    { name: "الإشعارات", href: "/notifications", icon: Bell },
    { name: "حسابي", href: "/user/profile", icon: User },
  ];

  const merchantNav = [
    { name: "لوحة القيادة", href: "/merchant/dashboard", icon: LayoutDashboard },
    { name: "الرحلات النشطة", href: "/merchant/trips", icon: Map },
    { name: "عروضي", href: "/merchant/offers", icon: PackageSearch },
    { name: "الفروع", href: "/merchant/branches", icon: MapPin },
    { name: "المنتجات", href: "/merchant/products", icon: Store },
    { name: "العمولات", href: "/merchant/commission", icon: Receipt },
    { name: "الإعدادات", href: "/merchant/settings", icon: Settings },
  ];

  const navItems = user?.actor === "MERCHANT" ? merchantNav : userNav;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row" dir="rtl">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-72 flex-col bg-card border-e border-border z-20 shadow-xl shadow-black/5 sticky top-0 h-screen overflow-y-auto">
        <div className="p-8 flex items-center gap-4 border-b border-border/50">
          <img src={`${import.meta.env.BASE_URL}images/logo-mark.png`} alt="Darbby" className="w-10 h-10 rounded-xl shadow-sm" />
          <div>
            <h1 className="text-2xl font-black text-primary tracking-tight">دربي</h1>
            <p className="text-xs text-muted-foreground font-medium">{user?.actor === "MERCHANT" ? "بوابة التاجر" : "منصة المسافر"}</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-accent/10 hover:text-primary"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <button 
            onClick={handleLogout}
            className="flex w-full items-center gap-4 px-4 py-3.5 rounded-xl font-bold text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 overflow-x-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}images/logo-mark.png`} alt="Darbby" className="w-8 h-8 rounded-lg shadow-sm" />
            <h1 className="text-xl font-black text-primary">دربي</h1>
          </div>
          <button onClick={handleLogout} className="p-2 text-destructive bg-destructive/10 rounded-lg">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 flex items-center justify-around p-2 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl transition-all w-16",
                isActive ? "text-accent" : "text-muted-foreground hover:text-primary"
              )}
            >
              <item.icon className={cn("w-6 h-6 mb-1 transition-transform", isActive && "scale-110 drop-shadow-md")} />
              <span className="text-[10px] font-bold">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
