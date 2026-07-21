import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Box, Tabs, Card, LoadingOverlay, useMantineColorScheme } from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { useProblemStore } from "../../../stores/problemStore";
import { useSubmissionStore } from "../../../stores/submissionStore";

// Subcomponents
import WorkspaceHeader from "../components/workspace/WorkspaceHeader";
import ProblemDescription from "../components/workspace/ProblemDescription";
import AddProblemToListModal from "../../userlist/components/AddProblemToListModal";
import SubmissionHistory from "../components/workspace/SubmissionHistory";
import ProblemDiscussions from "../components/workspace/ProblemDiscussions";
import ProblemNotes from "../components/workspace/ProblemNotes";
import CodeEditor from "../components/workspace/CodeEditor";
import WorkspaceConsole from "../components/workspace/WorkspaceConsole";
import EditorSettingsDrawer from "../components/workspace/EditorSettingsDrawer";
import CodeViewerDrawer from "../components/workspace/CodeViewerDrawer";
import ReviewBanner from "../../userlist/components/ReviewBanner";

// Static Data / Utils
import { templates } from "../data/templates";

const ProblemWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { colorScheme } = useMantineColorScheme();
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get("deck");
  const [autoRevealSR, setAutoRevealSR] = useState(false);

  // Stores
  const {
    currentProblem,
    getProblemById,
    isLoading: isProblemLoading,
    isError: isProblemError,
    message: problemMessage,
    reset: resetProblem,
  } = useProblemStore();

  const {
    runResult,
    submissionResult,
    submissions,
    getSubmissions,
    runSolution,
    submitSolution,
    isLoading: isSubmissionLoading,
    isError: isSubmissionError,
    message: submissionMessage,
    reset: resetSubmission,
  } = useSubmissionStore();

  // Left panel tabs
  const [leftTab, setLeftTab] = useState("description");

  // Code editor states
  const [language, setLanguage] = useState(
    () => localStorage.getItem(`greencode_lang_${id}`) || "cpp",
  );
  const [code, setCode] = useState(() => {
    return (
      localStorage.getItem(`greencode_code_${id}_${language}`) ||
      templates[language] ||
      ""
    );
  });

  // Monaco settings
  const theme = colorScheme === "dark" ? "vs-dark" : "light";
  const [fontSize, setFontSize] = useState(() =>
    parseInt(localStorage.getItem("greencode_editor_fontsize") || "14"),
  );
  const [wordWrap, setWordWrap] = useState(
    () => localStorage.getItem("greencode_editor_wordwrap") === "true",
  );
  const [minimap, setMinimap] = useState(
    () => localStorage.getItem("greencode_editor_minimap") === "true",
  );
  const [autocomplete, setAutocomplete] = useState(
    () => localStorage.getItem("greencode_editor_autocomplete") !== "false",
  );

  // UI state variables
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState("run");
  const [addToListModalOpen, setAddToListModalOpen] = useState(false);
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState(0);
  const [activeSubmissionCaseIndex, setActiveSubmissionCaseIndex] = useState(0);
  const [codeViewerOpen, setCodeViewerOpen] = useState(false);
  const [viewingCode, setViewingCode] = useState("");
  const [viewingLanguage, setViewingLanguage] = useState("cpp");

  // Load problem details
  useEffect(() => {
    getProblemById(id);
    getSubmissions(id);
    return () => {
      resetProblem();
      resetSubmission();
    };
  }, [id, getProblemById, getSubmissions, resetProblem, resetSubmission]);

  // Load/Save Code state
  useEffect(() => {
    localStorage.setItem(`greencode_lang_${id}`, language);
    const cachedCode = localStorage.getItem(`greencode_code_${id}_${language}`);
    if (cachedCode) {
      setCode(cachedCode);
    } else {
      setCode(templates[language] || "");
    }
  }, [language, id]);

  const handleCodeChange = (val) => {
    setCode(val || "");
    localStorage.setItem(`greencode_code_${id}_${language}`, val || "");
  };

  // Save Settings
  useEffect(() => {
    localStorage.setItem("greencode_editor_fontsize", fontSize.toString());
    localStorage.setItem("greencode_editor_wordwrap", wordWrap.toString());
    localStorage.setItem("greencode_editor_minimap", minimap.toString());
    localStorage.setItem(
      "greencode_editor_autocomplete",
      autocomplete.toString(),
    );
  }, [fontSize, wordWrap, minimap, autocomplete]);

  // Watch errors
  useEffect(() => {
    if (isProblemError) {
      notifications.show({
        title: "Workspace Error",
        message: problemMessage,
        color: "red",
      });
    }
    if (isSubmissionError) {
      notifications.show({
        title: "Execution Error",
        message: submissionMessage,
        color: "red",
      });
    }
  }, [isProblemError, problemMessage, isSubmissionError, submissionMessage]);

  // Watch submission status to auto-reveal spaced repetition buttons
  useEffect(() => {
    if (submissionResult && submissionResult.status === "Accepted") {
      setAutoRevealSR(true);
    }
  }, [submissionResult]);

  const isSubmissionPending =
    isSubmissionLoading ||
    (submissionResult &&
      (submissionResult.status === "queued" || submissionResult.status === "running"));

  // Handle run solution
  const handleRun = () => {
    if (isSubmissionPending) return;
    setConsoleTab("run");
    setActiveTestCaseIndex(0);
    runSolution({ problemId: id, code, language });
  };

  // Handle submit solution
  const handleSubmit = () => {
    if (isSubmissionPending) return;
    setConsoleTab("submit");
    setActiveSubmissionCaseIndex(0);
    submitSolution({ problemId: id, code, language }).then(() => {
      getSubmissions(id); // Reload history when done
    });
  };

  const handleOpenSubmissionCode = (sub) => {
    setViewingCode(sub.code);
    setViewingLanguage(sub.language || "cpp");
    setCodeViewerOpen(true);
  };

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 80px)",
        overflow: "hidden",
      }}
    >
      {/* Workspace Sub-header */}
      <WorkspaceHeader
        currentProblem={currentProblem}
        language={language}
        onLanguageChange={(val) => setLanguage(val || "cpp")}
        onOpenSettings={() => setSettingsOpen(true)}
        onBack={() => navigate("/problems")}
        onAddToList={() => setAddToListModalOpen(true)}
      />

      {/* Review Active Study Deck Banner */}
      {deckId && (
        <Box px="md" mt="sm">
          <ReviewBanner listId={deckId} problemId={id} autoReveal={autoRevealSR} />
        </Box>
      )}

      {/* Main Workspace Splitter */}
      <Box style={{ flexGrow: 1, position: "relative", minHeight: 0 }} mt={deckId ? "xs" : "sm"}>
        <LoadingOverlay visible={isProblemLoading} />

        {currentProblem && (
          <PanelGroup direction="horizontal">
            {/* Left Panel: Description and Submissions */}
            <Panel defaultSize={40} minSize={30}>
              <Card
                h="100%"
                p={0}
                withBorder
                style={{ display: "flex", flexDirection: "column" }}
              >
                <Tabs
                  value={leftTab}
                  onChange={setLeftTab}
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Tabs.List
                    style={{
                      borderBottom: "1px solid var(--mantine-color-default-border)",
                      backgroundColor: "var(--mantine-color-default-hover)",
                    }}
                    px="md"
                  >
                    <Tabs.Tab value="description">Description</Tabs.Tab>
                    <Tabs.Tab value="submissions">
                      Submissions ({submissions ? submissions.length : 0})
                    </Tabs.Tab>
                    <Tabs.Tab value="discussions">Discussions</Tabs.Tab>
                    <Tabs.Tab value="notes">My Notes</Tabs.Tab>
                  </Tabs.List>

                  <Box style={{ flexGrow: 1, overflow: "hidden", minHeight: 0 }}>
                    <Tabs.Panel value="description" h="100%">
                      <ProblemDescription
                        description={currentProblem.problem.description}
                        testCases={currentProblem.problem.testCases}
                        tags={currentProblem.problem.tags}
                      />
                    </Tabs.Panel>

                    <Tabs.Panel value="submissions" h="100%">
                      <SubmissionHistory
                        submissions={submissions}
                        onOpenSubmissionCode={handleOpenSubmissionCode}
                      />
                    </Tabs.Panel>

                    <Tabs.Panel value="discussions" h="100%">
                      <ProblemDiscussions problemId={id} />
                    </Tabs.Panel>

                    <Tabs.Panel value="notes" h="100%">
                      <ProblemNotes problemId={id} />
                    </Tabs.Panel>
                  </Box>
                </Tabs>
              </Card>
            </Panel>

            {/* Resize handler between description and editor workspace */}
            <PanelResizeHandle
              style={{
                width: "4px",
                backgroundColor: "var(--mantine-color-default-border)",
                cursor: "col-resize",
                margin: "0 6px",
                borderRadius: "2px",
              }}
            />

            {/* Right Panel: Editor and compiler results */}
            <Panel defaultSize={60} minSize={40}>
              <PanelGroup direction="vertical">
                {/* Editor Container */}
                <Panel defaultSize={70} minSize={50}>
                  <CodeEditor
                    language={language}
                    theme={theme}
                    code={code}
                    onCodeChange={handleCodeChange}
                    fontSize={fontSize}
                    wordWrap={wordWrap}
                    minimap={minimap}
                    autocomplete={autocomplete}
                    onRun={handleRun}
                    onSubmit={handleSubmit}
                    isSubmissionLoading={isSubmissionPending}
                  />
                </Panel>

                {/* Resize handler between editor and bottom console */}
                <PanelResizeHandle
                  style={{
                    height: "4px",
                    backgroundColor: "var(--mantine-color-default-border)",
                    cursor: "row-resize",
                    margin: "6px 0",
                    borderRadius: "2px",
                  }}
                />

                {/* Console results */}
                <Panel defaultSize={30} minSize={20}>
                  <WorkspaceConsole
                    consoleTab={consoleTab}
                    onTabChange={setConsoleTab}
                    isSubmissionLoading={isSubmissionPending}
                    runResult={runResult}
                    activeTestCaseIndex={activeTestCaseIndex}
                    setActiveTestCaseIndex={setActiveTestCaseIndex}
                    submissionResult={submissionResult}
                    activeSubmissionCaseIndex={activeSubmissionCaseIndex}
                    setActiveSubmissionCaseIndex={setActiveSubmissionCaseIndex}
                  />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        )}
      </Box>

      {/* Editor Settings Drawer */}
      <EditorSettingsDrawer
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fontSize={fontSize}
        setFontSize={setFontSize}
        wordWrap={wordWrap}
        setWordWrap={setWordWrap}
        minimap={minimap}
        setMinimap={setMinimap}
        autocomplete={autocomplete}
        setAutocomplete={setAutocomplete}
      />

      {/* Code Viewer Drawer for Submissions */}
      <CodeViewerDrawer
        opened={codeViewerOpen}
        onClose={() => setCodeViewerOpen(false)}
        code={viewingCode}
        language={viewingLanguage}
        theme={theme}
        fontSize={fontSize}
      />

      <AddProblemToListModal
        opened={addToListModalOpen}
        onClose={() => setAddToListModalOpen(false)}
        problem={currentProblem?.problem}
      />
    </Box>
  );
};

export default ProblemWorkspace;
