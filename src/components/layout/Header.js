import React, { useState, useEffect, useRef } from "react";
import { Bell, Menu, Sun, User, Search, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Header = ({ onMenuClick }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Get user data from localStorage
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserEmail(user.email || "");
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleLogout = () => {
    // Clear authentication data
    localStorage.clear();
    setUserMenuOpen(false);
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-6 z-50 sticky top-0 flex-shrink-0">
      <div className="w-full flex justify-between items-center gap-6">
        {/* Menu Button for Mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 border-none bg-transparent rounded-lg flex items-center justify-center cursor-pointer text-slate-400 transition-all hover:bg-slate-700 hover:text-white flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 flex justify-center max-w-2xl">
          <div className="w-full relative flex items-center">
            <Search className="absolute left-3.5 text-slate-400 pointer-events-none w-[18px] h-[18px]" />
            <input
              type="text"
              placeholder="Search By Keyword"
              className="w-full py-2.5 pl-10 pr-4 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-slate-600"
            />
          </div>
        </div>
        <div className="flex items-center flex-shrink-0 ">
          <div className="flex items-center gap-2 ">
            <button className="w-10 h-10 border-none bg-transparent rounded-lg flex items-center justify-center cursor-pointer text-slate-400 transition-all relative hover:bg-[#111827] text-gray-400 hover:text-white">
              <Sun />
            </button>
            <button className="w-10 h-10 border-none bg-transparent rounded-lg flex items-center justify-center cursor-pointer text-slate-400 transition-all relative hover:bg-[#111827] text-gray-400 hover:text-white">
              <Bell />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-800"></span>
            </button>
            <div
              className="flex items-center relative"
              ref={menuRef}
            >
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all relative bg-gradient-to-br from-purple-500 to-indigo-500 text-gray-400 hover:text-white"
                aria-label="User menu"
              >
                <User className="w-4 h-4" />
              </button>

              {/* User Menu Popup */}
              {userMenuOpen && (
                <div className="absolute right-0 top-12 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <p className="text-sm text-slate-400 mb-1">Signed in as</p>
                    <p className="text-sm font-medium text-white truncate">{userEmail || "User"}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
