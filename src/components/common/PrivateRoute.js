import React from "react";
import { Navigate } from "react-router-dom";

/**
 * PrivateRoute component to protect routes that require authentication
 * Redirects to /login if user is not authenticated
 */
const PrivateRoute = ({ children }) => {
  const authToken = localStorage.getItem("authToken");
  const user = localStorage.getItem("user");

  // Check if user is authenticated
  const isAuthenticated = authToken && user;

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // Render the protected component
  return children;
};

export default PrivateRoute;
