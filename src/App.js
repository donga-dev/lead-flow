import React, { useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MessageSquare } from "lucide-react";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Contacts from "./components/messages/Contacts";
import Messages from "./components/messages/Messages";
import Channels from "./components/channels/Channels";
import { SocketProvider } from "./contexts/SocketContext";

function App() {
  const [activeView, setActiveView] = useState("messages");
  const [selectedContact, setSelectedContact] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
  };

  const handleSendMessage = (message) => {
    // Refresh contacts list after sending message
    // This will be handled by the Messages component
    console.log("Message sent:", message);
  };

  const renderContent = () => {
    // Only show content for messages and channels, others show empty state
    if (activeView === "channels") {
      return <Channels />;
    }

    if (activeView === "messages") {
      return (
        <div className="flex h-full w-full md:p-6 p-0 bg-[#111827]">
          <div className="w-[300px] min-w-[300px] max-w-[500px] border-r border-slate-700 flex flex-col overflow-hidden bg-slate-800">
            <Contacts
              onSelectContact={handleContactSelect}
              selectedContact={selectedContact}
            />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
            {selectedContact ? (
              <Messages
                selectedContact={selectedContact}
                onSendMessage={handleSendMessage}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-900">
                <div className="text-center text-slate-400 p-10">
                  <div className="w-[120px] h-[120px] mx-auto mb-6 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-20 h-20 text-purple-500 opacity-80" />
                  </div>
                  <h3 className="text-2xl font-semibold m-0 mb-2 text-slate-100">
                    Welcome to LeadFlow Chat
                  </h3>
                  <p className="text-sm m-0">Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Empty state for other tabs (no content)
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

  return (
    <SocketProvider>
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
            activeView={activeView}
            onViewChange={setActiveView}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <main className="flex-1 flex flex-col overflow-hidden bg-slate-800 lg:ml-64 transition-all duration-300 h-full">
            <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
            <div className="flex-1 overflow-hidden">{renderContent()}</div>
          </main>
        </div>
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
      </div>
    </SocketProvider>
  );
}

export default App;
