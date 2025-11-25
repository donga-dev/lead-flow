import React from "react";
import { Navigate } from "react-router-dom";

/**
 * PublicRoute component to redirect authenticated users away from auth pages
 * Redirects to /messages if user is already authenticated
 */
const PublicRoute = ({ children }) => {
  const authToken = localStorage.getItem("authToken");
  const user = localStorage.getItem("user");

  // Check if user is authenticated
  const isAuthenticated = authToken && user;

  if (isAuthenticated) {
    // Redirect to messages if already authenticated
    return <Navigate to="/messages" replace />;
  }

  // Render the public component (login/register)
  return children;
};

export default PublicRoute;

