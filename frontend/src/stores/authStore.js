import { create } from "zustand";
import api from "../lib/api";

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("user")) || null,
  isLoading: false,
  isError: false,
  isSuccess: false,
  message: "",

  login: async (userData) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const response = await api.post("/auth/login", userData);
      const data = response.data;
      if (data) {
        localStorage.setItem("user", JSON.stringify(data));
      }
      set({ user: data, isLoading: false, isSuccess: true });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ user: null, isLoading: false, isError: true, message });
    }
  },

  register: async (userData) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const response = await api.post("/auth/register", userData);
      const data = response.data;
      if (data) {
        localStorage.setItem("user", JSON.stringify(data));
      }
      set({ user: data, isLoading: false, isSuccess: true });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ user: null, isLoading: false, isError: true, message });
    }
  },

  verifyEmail: async (token) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const response = await api.get(`/auth/verify-email?token=${token}`);
      const data = response.data;

      // If user is currently logged in, update their isVerified flag in store & localStorage
      const currentUser = get().user;
      if (currentUser) {
        const updatedUser = { ...currentUser, isVerified: true };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        set({ user: updatedUser, isLoading: false, isSuccess: true, message: data.message });
      } else {
        set({ isLoading: false, isSuccess: true, message: data.message });
      }
      return { success: true, data };
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ isLoading: false, isError: true, message });
      return { success: false, message };
    }
  },

  resendVerification: async (email) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const targetEmail = email || get().user?.email;
      const response = await api.post("/auth/resend-verification", { email: targetEmail });
      set({ isLoading: false, isSuccess: true, message: response.data.message });
      return { success: true, message: response.data.message };
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ isLoading: false, isError: true, message });
      return { success: false, message };
    }
  },

  logout: () => {
    localStorage.removeItem("user");
    set({ user: null, isError: false, isSuccess: false, isLoading: false, message: "" });
  },

  reset: () => {
    set({ isLoading: false, isSuccess: false, isError: false, message: "" });
  },
}));
