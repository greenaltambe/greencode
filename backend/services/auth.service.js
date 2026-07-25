import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { AppError } from "../utils/errors.js";
import { sendVerificationEmail } from "./email.service.js";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

export const registerUser = async ({ name, email, password }) => {
  if (!name || !email || !password) {
    throw new AppError("Please add all fields", 400);
  }

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError("User already exists", 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Generate random 32-byte hex verification token
  const rawVerificationToken = crypto.randomBytes(32).toString("hex");

  // Hash token for secure DB storage (SHA-256)
  const hashedVerificationToken = crypto
    .createHash("sha256")
    .update(rawVerificationToken)
    .digest("hex");

  const verificationTokenExpire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user with isVerified: false and hashed token
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: "user",
    isVerified: false,
    verificationToken: hashedVerificationToken,
    verificationTokenExpire,
  });

  if (!user) {
    throw new AppError("Invalid user data", 400);
  }

  // Send verification email with raw (unhashed) token
  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    token: rawVerificationToken,
  });

  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: false,
    token: generateToken(user._id),
  };
};

export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw new AppError("Please add all fields", 400);
  }

  // Check for user email
  const user = await User.findOne({ email });

  if (user && (await bcrypt.compare(password, user.password))) {
    return {
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified || false,
      token: generateToken(user._id),
    };
  } else {
    throw new AppError("Invalid credentials", 400);
  }
};

export const verifyEmailToken = async (token) => {
  console.log("[Auth Service] Received token for verification:", token);
  if (!token) {
    throw new AppError("Verification token is required", 400);
  }

  // Hash incoming token to match DB record
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  console.log("[Auth Service] Hashed incoming token:", hashedToken);

  // Find user with matching token that hasn't expired
  const user = await User.findOne({
    verificationToken: hashedToken,
  });

  if (!user) {
    console.error("[Auth Service Error] No user found with verificationToken:", hashedToken);
    throw new AppError("Invalid or expired verification token", 400);
  }

  console.log("[Auth Service] Found user:", user.email, "isVerified:", user.isVerified, "expires:", user.verificationTokenExpire);

  if (user.verificationTokenExpire && user.verificationTokenExpire <= new Date()) {
    console.error("[Auth Service Error] Token expired at:", user.verificationTokenExpire, "current time:", new Date());
    throw new AppError("Invalid or expired verification token", 400);
  }

  // Update user as verified & delete verification token fields
  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpire = undefined;
  await user.save();

  return {
    message: "Email verified successfully",
    isVerified: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: true,
    },
  };
};

export const resendVerificationEmail = async (email) => {
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.isVerified) {
    return {
      message: "Email is already verified",
      isVerified: true,
    };
  }

  // Generate new token & hash
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  user.verificationToken = hashedToken;
  user.verificationTokenExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  // Send email
  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    token: rawToken,
  });

  return {
    message: "Verification email sent successfully",
  };
};

/**
 * Seed initial admin user if none exist in the database
 */
export const bootstrapAdmin = async () => {
  try {
    // Check if at least one admin exists
    const adminExists = await User.findOne({ role: "admin" });
    if (adminExists) {
      console.log("[Admin Bootstrap] Admin user already exists. Skipping bootstrap.");
      return;
    }

    const email = process.env.INITIAL_ADMIN_EMAIL;
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    const name = process.env.INITIAL_ADMIN_NAME;

    if (!email || !password || !name) {
      console.warn("[Admin Bootstrap Warning] INITIAL_ADMIN environment variables are not fully configured. Skipping bootstrap.");
      return;
    }

    console.log(`[Admin Bootstrap] Seeding initial admin user: ${email}`);

    // If a user already exists with the bootstrap email, promote them to admin
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      existingUser.role = "admin";
      existingUser.isVerified = true;
      await existingUser.save();
      console.log(`[Admin Bootstrap] Promoted existing user ${email} to admin.`);
      return;
    }

    // Hash password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create verified admin user
    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      isVerified: true,
    });

    console.log("[Admin Bootstrap] Initial admin user successfully bootstrapped!");
  } catch (error) {
    console.error("[Admin Bootstrap Error] Failed to bootstrap admin user:", error);
  }
};
