import { useState, useEffect } from 'react';
import { Home, Upload, Activity, Calendar, Scale, User, Moon, Sun } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize theme
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const navItems = [
    { name: 'หน้าหลัก', path: '/', icon: Home },
    // { name: 'นำเข้า', path: '/import', icon: Upload },
    { name: 'ประวัติ', path: '/sessions', icon: Activity },
    { name: 'แผนซ้อม', path: '/plan', icon: Calendar },
    { name: 'สรีระ', path: '/body', icon: Scale },
    { name: 'โปรไฟล์', path: '/profile', icon: User },
  ];

  return (
    <div className={`h-[100dvh] w-full flex flex-col md:flex-row text-gray-900 bg-gray-50 dark:text-gray-100 dark:bg-zinc-950 transition-colors duration-300 overflow-hidden`}>
      
      {/* Mobile Top Bar */}
      <header className="md:hidden shrink-0 z-40 w-full h-14 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-4 pt-safe-top">
        <div>
          <h1 className="text-xl font-black tracking-tighter text-blue-600 dark:text-blue-400">LONG-VING</h1>
        </div>
        <button onClick={toggleTheme} className="p-2 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 rounded-full active:scale-95 transition-transform">
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 shrink-0">
        <div className="p-6 flex items-center justify-between border-b border-gray-200 dark:border-zinc-800">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-blue-600 dark:text-blue-400">LONG-VING</h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1">running analysis</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path) && item.path !== '/';
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium translate-x-1' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-gray-200 hover:translate-x-1'
                }`}
              >
                <Icon size={20} className={`${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span className="text-[15px]">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-800">
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all font-medium"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-[15px]">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scroll-smooth w-full relative">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden shrink-0 z-40 w-full h-[68px] bg-white border-t border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 flex justify-around items-center px-1 pb-safe-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <div className={`p-1 rounded-full transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium leading-tight whitespace-nowrap">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
