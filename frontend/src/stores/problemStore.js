import { create } from "zustand";
import api from "../lib/api";

export const useProblemStore = create((set) => ({
  problems: [],
  totalPages: 1,
  currentPage: 1,
  totalProblems: 0,
  currentProblem: null,
  isLoading: false,
  isError: false,
  isSuccess: false,
  message: "",

  getProblems: async (params = {}) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const response = await api.get("/problems", { params });
      set({
        problems: response.data.problems || [],
        totalPages: response.data.totalPages || 1,
        currentPage: response.data.currentPage || 1,
        totalProblems: response.data.totalProblems || 0,
        isLoading: false,
        isSuccess: true,
      });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ isLoading: false, isError: true, message });
    }
  },

  getProblemById: async (id) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const response = await api.get(`/problems/${id}`);
      set({ currentProblem: response.data, isLoading: false, isSuccess: true });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ isLoading: false, isError: true, message });
    }
  },

  createProblem: async (formData) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const response = await api.post("/problems", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      set((state) => ({
        problems: [...state.problems, response.data.problem],
        isLoading: false,
        isSuccess: true,
      }));
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ isLoading: false, isError: true, message });
    }
  },

  updateProblem: async (id, problemData) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const headers = problemData instanceof FormData
        ? { "Content-Type": "multipart/form-data" }
        : {};
      const response = await api.put(`/problems/${id}`, problemData, { headers });
      set((state) => ({
        problems: state.problems.map((prob) =>
          prob._id === id ? response.data.problem : prob
        ),
        currentProblem: state.currentProblem && state.currentProblem.problem._id === id 
          ? { ...state.currentProblem, problem: response.data.problem } 
          : state.currentProblem,
        isLoading: false,
        isSuccess: true,
      }));
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ isLoading: false, isError: true, message });
    }
  },

  deleteProblem: async (id) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      await api.delete(`/problems/${id}`);
      set((state) => ({
        problems: state.problems.filter((prob) => prob._id !== id),
        isLoading: false,
        isSuccess: true,
      }));
      return true;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ isLoading: false, isError: true, message });
      return false;
    }
  },

  importProblems: async (formData) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const response = await api.post("/problems/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      set({ isLoading: false, isSuccess: true });
      return response.data;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ isLoading: false, isError: true, message });
      return null;
    }
  },

  reset: () => {
    set({
      currentProblem: null,
      isLoading: false,
      isError: false,
      isSuccess: false,
      message: "",
    });
  },
}));
