import { create } from "zustand";
import api from "../lib/api";
import socket from "../lib/socket";

export const useSubmissionStore = create((set, get) => ({
  runResult: null,
  submissions: null,
  submissionResult: null,
  isLoading: false,
  isError: false,
  isSuccess: false,
  message: "",

  runSolution: async (payload) => {
    if (get().isLoading) return;
    set({ isLoading: true, isError: false, isSuccess: false, message: "", runResult: null });
    try {
      const response = await api.post("/problems/run", payload);
      set({ runResult: response.data, isLoading: false, isSuccess: true });
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

  submitSolution: async (payload) => {
    const state = get();
    // Guard against duplicate submission while processing/queued
    if (
      state.isLoading ||
      (state.submissionResult &&
        (state.submissionResult.status === "queued" ||
          state.submissionResult.status === "running"))
    ) {
      console.warn("Submission already in progress!");
      return;
    }

    set({ isLoading: true, isError: false, isSuccess: false, message: "", submissionResult: null });
    try {
      const response = await api.post("/problems/submit", payload);
      const submissionId = response.data.submissionId;

      // Set initial status to queued so UI shows it immediately
      set({ submissionResult: { status: "queued", _id: submissionId } });

      return new Promise((resolve, reject) => {
        let cleanup = null;

        const timeoutId = setTimeout(async () => {
          if (cleanup) cleanup();
          // Fallback check if socket event didn't arrive in 45s
          try {
            const res = await api.get(`/problems/submissions/${submissionId}`);
            set({ submissionResult: res.data, isLoading: false, isSuccess: true });
            resolve(res.data);
          } catch (e) {
            set({ isLoading: false, isError: true, message: "Submission judgment timed out." });
            reject(new Error("Submission judgment timed out."));
          }
        }, 45000);

        const handleUpdate = (data) => {
          if (data && data.submissionId === submissionId) {
            const sub = data.submission || { status: data.status, _id: submissionId };
            set({ submissionResult: sub });

            if (data.status !== "queued" && data.status !== "running") {
              clearTimeout(timeoutId);
              if (cleanup) cleanup();
              set({ isLoading: false, isSuccess: true });
              resolve(sub);
            }
          }
        };

        cleanup = () => {
          socket.off("submission_update", handleUpdate);
          socket.emit("leave_submission", submissionId);
        };

        socket.emit("join_submission", submissionId);
        socket.on("submission_update", handleUpdate);
      });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      set({ submissionResult: null, isLoading: false, isError: true, message });
    }
  },

  getSubmissions: async (id) => {
    set({ isLoading: true, isError: false, isSuccess: false, message: "" });
    try {
      const response = await api.get(`/problems/${id}/submissions`);
      set({ submissions: response.data.submissions || [], isLoading: false, isSuccess: true });
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

  reset: () => {
    set({
      runResult: null,
      submissions: null,
      submissionResult: null,
      isLoading: false,
      isError: false,
      isSuccess: false,
      message: "",
    });
  },
}));
