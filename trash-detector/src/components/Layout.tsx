import { Link, useLocation } from "wouter";
import { Leaf, History, BarChart3, Upload } from "lucide-react";
import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Analyzer", icon: Upload },
    { href: "/history", label: "History", icon: History },
    { href: "/stats", label: "Statistics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-b md:border-r border-border md:min-h-screen flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground shadow-sm">
            <Leaf size={18} strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-lg tracking-tight">TrashScan AI</span>
        </div>
        
        <nav className="flex-1 px-4 pb-4 md:py-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible hide-scrollbar">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium shrink-0 md:shrink ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon size={18} className={isActive ? "text-primary" : "text-muted-foreground"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
