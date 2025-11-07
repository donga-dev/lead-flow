import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to backend Socket.io server
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "https://unexigent-felisha-calathiform.ngrok-free.dev";

    console.log(`🔌 Attempting to connect to Socket.io server at ${backendUrl}`);

    const newSocket = io(backendUrl, {
      path: "/socket.io/", // Explicitly set Socket.io path
      transports: ["polling", "websocket"], // Try polling first, then websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
      forceNew: false,
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    newSocket.on("connect", () => {
      console.log("✅ Connected to backend via Socket.io");
      setConnected(true);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Disconnected from backend:", reason);
      setConnected(false);

      // If disconnected unexpectedly, try to reconnect
      if (reason === "io server disconnect") {
        // Server disconnected the socket, manual reconnect needed
        newSocket.connect();
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
      console.log("💡 Make sure the backend server is running on port 3001");
      setConnected(false);
    });

    newSocket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setConnected(true);
    });

    newSocket.on("reconnect_failed", () => {
      console.error("❌ Failed to reconnect to backend");
      setConnected(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log("🔌 Closing Socket.io connection");
      newSocket.close();
    };
  }, []);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
};
