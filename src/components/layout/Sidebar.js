import {
  ChartColumn,
  FileText,
  FileUser,
  LayoutDashboard,
  Link,
  LogOut,
  MessageCircle,
  Settings,
  Users,
  X,
} from "lucide-react";
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      path: "/messages",
      label: "Messages",
      icon: <MessageCircle className="w-5 h-5" />,
    },
    {
      path: "/leads",
      label: "Leads",
      icon: <FileUser className="w-5 h-5" />,
    },
    {
      path: "/contacts",
      label: "Contacts",
      icon: <Users className="w-5 h-5" />,
    },
    {
      path: "/analytics",
      label: "Analytics",
      icon: <ChartColumn className="w-5 h-5" />,
    },
    {
      path: "/channels",
      label: "Channels",
      icon: <Link className="w-5 h-5" />,
    },
    {
      path: "/reports",
      label: "Reports",
      icon: <FileText className="w-5 h-5" />,
    },
    {
      path: "/settings",
      label: "Settings",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const isActive = (path) => {
    if (path === "/messages") {
      return location.pathname.startsWith("/messages");
    }
    return location.pathname === path;
  };

  const handleLogout = () => {
    // Clear authentication data
    localStorage.clear();

    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <>
      <aside
        className={`w-64 bg-[#1e293b] flex flex-col h-full fixed inset-y-0 left-0 z-[51] transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 12C8 10.8954 8.89543 10 10 10H14C15.1046 10 16 10.8954 16 12V16C16 17.1046 15.1046 18 14 18H10C8.89543 18 8 17.1046 8 16V12Z"
                  fill="url(#gradient1)"
                />
                <path
                  d="M18 12C18 10.8954 18.8954 10 20 10H24C25.1046 10 26 10.8954 26 12V16C26 17.1046 25.1046 18 24 18H20C18.8954 18 18 17.1046 18 16V12Z"
                  fill="url(#gradient2)"
                />
                <path
                  d="M8 20C8 18.8954 8.89543 18 10 18H14C15.1046 18 16 18.8954 16 20V24C16 25.1046 15.1046 26 14 26H10C8.89543 26 8 25.1046 8 24V20Z"
                  fill="url(#gradient2)"
                />
                <path
                  d="M18 20C18 18.8954 18.8954 18 20 18H24C25.1046 18 26 18.8954 26 20V24C26 25.1046 25.1046 26 24 26H20C18.8954 26 18 25.1046 18 24V20Z"
                  fill="url(#gradient1)"
                />
                <defs>
                  <linearGradient
                    id="gradient1"
                    x1="8"
                    y1="10"
                    x2="16"
                    y2="26"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#8B5CF6" />
                    <stop
                      offset="1"
                      stopColor="#6366F1"
                    />
                  </linearGradient>
                  <linearGradient
                    id="gradient2"
                    x1="18"
                    y1="10"
                    x2="26"
                    y2="26"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#6366F1" />
                    <stop
                      offset="1"
                      stopColor="#3B82F6"
                    />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white m-0 tracking-tight">LeadFlow</h1>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Navigation Items */}
        <nav className="flex flex-col flex-1 py-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive: navIsActive }) => {
                const active = navIsActive || isActive(item.path);
                return `relative flex items-center gap-3 px-6 py-3 cursor-pointer text-sm transition-all text-left w-full text-white ${
                  active
                    ? "border-r-2 border-solid border-blue-500 bg-gray-700"
                    : "hover:bg-gray-700"
                }`;
              }}
              onClick={() => {
                // Close sidebar on mobile after selecting an item
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
            >
              <span className="flex-shrink-0 text-[#f1f5f9]">{item.icon}</span>
              <span className="flex-1 text-[#f1f5f9] text-base font-normal">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="px-6 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-6 py-3 border-none cursor-pointer text-sm font-medium transition-all text-left text-red-500 bg-transparent hover:bg-gray-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-base font-normal">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
