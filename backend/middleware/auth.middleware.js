import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";
import { AppError } from "../utils/errors.js";

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user and attach to request object (excluding password)
      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) {
        throw new AppError("Not authorized, user not found", 401);
      }

      next();
    } catch (error) {
      console.error(error);
      if (error instanceof AppError) throw error;
      throw new AppError("Not authorized", 401);
    }
  }

  if (!token) {
    throw new AppError("Not authorized, no token", 401);
  }
});

// Reusable middlewares matching requested signatures
export const authenticate = protect;

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      next();
    } else {
      throw new AppError("Forbidden: Access is denied", 403);
    }
  };
};

// Legacy support
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    throw new AppError("Not authorized as admin", 401);
  }
};
