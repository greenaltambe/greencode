import asyncHandler from "express-async-handler";
import * as authService from "../services/auth.service.js";

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.registerUser({ name, email, password });
  res.status(201).json(result);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.loginUser({ email, password });
  res.status(200).json(result);
});

// @desc    Get user
// @route   GET /api/auth/user
// @access  Private
export const getUser = asyncHandler(async (req, res) => {
  res.status(200).json(req.user);
});

// @desc    Verify email address
// @route   GET /api/auth/verify-email
// @access  Public
export const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.query.token || req.body.token;
  const result = await authService.verifyEmailToken(token);
  res.status(200).json(result);
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = asyncHandler(async (req, res) => {
  const email = req.body.email || req.user?.email;
  const result = await authService.resendVerificationEmail(email);
  res.status(200).json(result);
});
