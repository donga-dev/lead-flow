import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Middleware to authenticate JWT tokens (required)
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Access denied.",
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Access denied.",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found. Access denied.",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User account is inactive. Access denied.",
        });
      }

      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired. Please login again.",
        });
      } else if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token. Access denied.",
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error. Please try again.",
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token is provided
 * Sets req.user if a valid token is present, otherwise continues without it
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    // If no auth header, continue without setting req.user
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    // Extract token
    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select("-password");

      if (user && user.isActive) {
        // Attach user to request object only if user exists and is active
        req.user = user;
      }
    } catch (error) {
      // Silently ignore token errors for optional auth
      // Invalid/expired tokens just mean req.user won't be set
      console.log("Optional auth: Token validation failed (non-critical):", error.message);
    }

    next();
  } catch (error) {
    // Continue even if there's an error
    console.error("Optional auth middleware error:", error);
    next();
  }
};
