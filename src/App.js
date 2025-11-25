import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MessageSquare } from "lucide-react";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Messages from "./components/messages/Messages";
import Channels from "./components/channels/Channels";
import Analytics from "./components/analytics/Analytics";
import Auth from "./components/auth/Auth";
import PrivateRoute from "./components/common/PrivateRoute";
import PublicRoute from "./components/common/PublicRoute";
import { SocketProvider } from "./contexts/SocketContext";

// Coming Soon Component
const ComingSoon = () => {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#111827] h-full">
      <div className="text-center text-slate-400 p-10">
        <MessageSquare className="w-[120px] h-[120px] opacity-30 mb-6 mx-auto" />
        <h3 className="text-2xl font-semibold m-0 mb-2 text-slate-100">Coming Soon</h3>
        <p className="text-sm m-0">This section is under development</p>
      </div>
    </div>
  );
};

// Main Layout Component
const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col bg-slate-900">
      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden h-screen">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-800 lg:ml-64 transition-all duration-300 h-full">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route
                path="/"
                element={
                  <Navigate
                    to="/messages"
                    replace
                  />
                }
              />
              <Route
                path="/messages"
                element={<Messages />}
              />
              <Route
                path="/messages/:contactId"
                element={<Messages />}
              />
              <Route
                path="/channels"
                element={<Channels />}
              />
              <Route
                path="/dashboard"
                element={<ComingSoon />}
              />
              <Route
                path="/leads"
                element={<ComingSoon />}
              />
              <Route
                path="/contacts"
                element={<ComingSoon />}
              />
              <Route
                path="/analytics"
                element={<Analytics />}
              />
              <Route
                path="/reports"
                element={<ComingSoon />}
              />
              <Route
                path="/settings"
                element={<ComingSoon />}
              />
              <Route
                path="*"
                element={
                  <Navigate
                    to="/messages"
                    replace
                  />
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes - Redirect if authenticated */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            }
          />

          {/* Protected Routes - Require authentication */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          />
        </Routes>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;
