import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";
import { AppError } from "../utils/errors.js";

// @desc    Promote user to admin
// @route   POST /api/admin/users/:userId/promote
// @access  Private (Admin only)
export const promoteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role === "admin") {
    throw new AppError("User is already an admin", 400);
  }

  user.role = "admin";
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${user.email} promoted to admin successfully.`,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
  });
});

// @desc    Get all users or search users
// @route   GET /api/admin/users
// @access  Private (Admin only)
export const getUsers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skipNum = (pageNum - 1) * limitNum;

  let query = {};

  if (search) {
    query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };
  }

  const totalUsers = await User.countDocuments(query);
  const users = await User.find(query)
    .select("-password")
    .sort({ createdAt: -1 })
    .skip(skipNum)
    .limit(limitNum);

  const totalPages = Math.ceil(totalUsers / limitNum);

  res.status(200).json({
    success: true,
    users,
    currentPage: pageNum,
    totalPages,
    totalUsers,
    limit: limitNum,
  });
});

