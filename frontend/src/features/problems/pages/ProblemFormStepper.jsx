import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Stepper, LoadingOverlay, Stack, Title, Text, SegmentedControl, FileInput, Radio, Card, Table, Badge, Divider, Alert, Button, Group } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileZip, IconUpload, IconCheck, IconX, IconInfoCircle } from "@tabler/icons-react";
import { useProblemStore } from "../../../stores/problemStore";
import { marked } from "marked";

// Subcomponents
import BasicInfoStep from "../components/form/BasicInfoStep";
import DescriptionStep from "../components/form/DescriptionStep";
import ExamplesStep from "../components/form/ExamplesStep";
import UploadFilesStep from "../components/form/UploadFilesStep";
import PreviewStep from "../components/form/PreviewStep";
import CompletedStep from "../components/form/CompletedStep";
import StepperNavigation from "../components/form/StepperNavigation";

// Utilities
import { getDifficultyColor } from "../utils/difficulty";

const ProblemFormStepper = ({ mode = "create" }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentProblem,
    getProblemById,
    createProblem,
    updateProblem,
    importProblems,
    isLoading,
    isError,
    isSuccess,
    message,
    reset,
  } = useProblemStore();

  const [activeStep, setActiveStep] = useState(0);

  // Form states
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [description, setDescription] = useState("");
  const [testCases, setTestCases] = useState([{ input: "", expectedOutput: "" }]);
  const [inputsFiles, setInputsFiles] = useState([]);
  const [outputsFiles, setOutputsFiles] = useState([]);
  const [tags, setTags] = useState([]);
  const [checkerFile, setCheckerFile] = useState(null);
  const [existingChecker, setExistingChecker] = useState(null);
  const [removeChecker, setRemoveChecker] = useState(false);

  // Import states
  const [creationMethod, setCreationMethod] = useState("manual");
  const [zipFile, setZipFile] = useState(null);
  const [importType, setImportType] = useState("single");
  const [importResult, setImportResult] = useState(null);

  // Fetch problem details if editing
  useEffect(() => {
    if (mode === "edit" && id) {
      getProblemById(id);
    }
    return () => {
      reset();
      setCheckerFile(null);
      setExistingChecker(null);
      setRemoveChecker(false);
    };
  }, [mode, id, getProblemById, reset]);

  // Populate fields on edit load
  useEffect(() => {
    if (mode === "edit" && currentProblem && currentProblem.problem) {
      const prob = currentProblem.problem;
      setTitle(prob.title);
      setDifficulty(prob.difficulty || "easy");
      setDescription(prob.description);
      if (prob.testCases && prob.testCases.length > 0) {
        setTestCases(prob.testCases);
      }
      setTags(prob.tags || []);
      setExistingChecker(prob.checker || null);
      setRemoveChecker(false);
    }
  }, [mode, currentProblem]);

  // Handle operation success/error notifications
  useEffect(() => {
    if (isSuccess && activeStep === 5) {
      notifications.show({
        title: mode === "create" ? "Problem Created" : "Problem Updated",
        message: `Successfully saved "${title}"!`,
        color: "blue",
      });
      reset();
      navigate("/problems");
    }

    if (isError) {
      notifications.show({
        title: "Operation Failed",
        message: message || "Please review fields or files.",
        color: "red",
      });
      reset();
    }
  }, [isSuccess, isError, message, reset, navigate, mode, title, activeStep]);

  const handleDropChecker = (files) => {
    const file = files[0];
    if (!file) return;
    if (file.name !== "checker.py") {
      notifications.show({
        title: "Invalid file name",
        message: "Checker file must be named strictly 'checker.py'.",
        color: "orange",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notifications.show({
        title: "File too large",
        message: "Checker file exceeds the maximum allowed size (5MB).",
        color: "orange",
      });
      return;
    }
    setCheckerFile(file);
    setRemoveChecker(false);
  };

  const handleRemoveChecker = () => {
    setCheckerFile(null);
  };

  const handleToggleRemoveExistingChecker = () => {
    setRemoveChecker((prev) => !prev);
    setCheckerFile(null);
  };

  const handleAddExample = () => {
    setTestCases([...testCases, { input: "", expectedOutput: "" }]);
  };

  const handleRemoveExample = (idx) => {
    setTestCases(testCases.filter((_, i) => i !== idx));
  };

  const handleExampleChange = (idx, field, value) => {
    const updated = [...testCases];
    updated[idx][field] = value;
    setTestCases(updated);
  };

  // Drag and drop test files handlers
  const handleDropInputs = (files) => {
    const valid = files.filter((f) => f.name.match(/input_(\d+)/));
    const invalidCount = files.length - valid.length;

    if (invalidCount > 0) {
      notifications.show({
        title: "Invalid file name",
        message: `${invalidCount} files ignored. Input files must match the format "input_X.txt" (e.g. input_1.txt).`,
        color: "orange",
      });
    }

    setInputsFiles((prev) => [...prev, ...valid]);
  };

  const handleDropOutputs = (files) => {
    const valid = files.filter((f) => f.name.match(/output_(\d+)/));
    const invalidCount = files.length - valid.length;

    if (invalidCount > 0) {
      notifications.show({
        title: "Invalid file name",
        message: `${invalidCount} files ignored. Output files must match the format "output_X.txt" (e.g. output_1.txt).`,
        color: "orange",
      });
    }

    setOutputsFiles((prev) => [...prev, ...valid]);
  };

  const handleRemoveInputFile = (idx) => {
    setInputsFiles(inputsFiles.filter((_, i) => i !== idx));
  };

  const handleRemoveOutputFile = (idx) => {
    setOutputsFiles(outputsFiles.filter((_, i) => i !== idx));
  };

  // Compile Markdown to HTML
  const getParsedDescription = () => {
    try {
      return { __html: marked.parse(description || "") };
    } catch (e) {
      return { __html: description || "" };
    }
  };

  const handleSave = () => {
    if (!title || !description || !difficulty) {
      notifications.show({ title: "Validation Error", message: "Please fill in basic fields.", color: "red" });
      return;
    }

    if (testCases.some((tc) => !tc.input.trim() || !tc.expectedOutput.trim())) {
      notifications.show({ title: "Validation Error", message: "All example test cases must contain input and output.", color: "red" });
      return;
    }

    if (mode === "create") {
      if (inputsFiles.length === 0 || outputsFiles.length === 0) {
        notifications.show({ title: "Validation Error", message: "Please upload both input and output files.", color: "red" });
        return;
      }
      if (inputsFiles.length !== outputsFiles.length) {
        notifications.show({ title: "Validation Error", message: "Mismatched count of input and output files.", color: "red" });
        return;
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("difficulty", difficulty);
      formData.append("testCases", JSON.stringify(testCases));
      formData.append("tags", JSON.stringify(tags));
      inputsFiles.forEach((f) => formData.append("inputs", f));
      outputsFiles.forEach((f) => formData.append("outputs", f));
      if (checkerFile) {
        formData.append("checker", checkerFile);
      }

      createProblem(formData);
    } else {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("difficulty", difficulty);
      formData.append("testCases", JSON.stringify(testCases));
      formData.append("tags", JSON.stringify(tags));
      if (checkerFile) {
        formData.append("checker", checkerFile);
      }
      if (removeChecker) {
        formData.append("removeChecker", "true");
      }

      updateProblem(id, formData);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!zipFile) {
      notifications.show({
        title: "Validation Error",
        message: "Please select a ZIP file to import.",
        color: "red",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", zipFile);
    formData.append("type", importType);

    const result = await importProblems(formData);
    if (result) {
      setImportResult(result);
      notifications.show({
        title: "Import Completed",
        message: `Processed archive: ${result.summary.imported} imported, ${result.summary.failed} failed.`,
        color: "green",
      });
      setZipFile(null);
    }
  };

  const nextStep = () => {
    if (activeStep === 0 && !title.trim()) {
      notifications.show({ title: "Validation Error", message: "Please add a Title.", color: "red" });
      return;
    }
    if (activeStep === 1 && !description.trim()) {
      notifications.show({ title: "Validation Error", message: "Please write a problem description.", color: "red" });
      return;
    }
    if (activeStep === 2 && testCases.some((tc) => !tc.input.trim() || !tc.expectedOutput.trim())) {
      notifications.show({ title: "Validation Error", message: "Please fill in all examples input/output.", color: "red" });
      return;
    }
    if (mode === "create" && activeStep === 3) {
      if (inputsFiles.length === 0 || outputsFiles.length === 0) {
        notifications.show({ title: "Validation Error", message: "Upload input and output files to compile.", color: "red" });
        return;
      }
      if (inputsFiles.length !== outputsFiles.length) {
        notifications.show({ title: "Validation Error", message: "Mismatched input/output file pairs count.", color: "red" });
        return;
      }
    }
    setActiveStep((current) => current + 1);
  };

  const prevStep = () => setActiveStep((current) => current - 1);

  return (
    <Container size="xl" py="xl" style={{ position: "relative" }}>
      <LoadingOverlay visible={isLoading} />

      <Stack gap="xl">
        <div>
          <Title order={2} style={{ letterSpacing: "-0.5px" }}>
            {mode === "create" ? "Publish New Problem" : "Edit Coding Problem"}
          </Title>
          <Text size="sm" c="dimmed">
            Setup basic metadata, build custom description markup, and upload test execution criteria files.
          </Text>
        </div>

        {mode === "create" && (
          <SegmentedControl
            value={creationMethod}
            onChange={(val) => {
              setCreationMethod(val);
              setImportResult(null);
            }}
            data={[
              { label: "Manual Creation", value: "manual" },
              { label: "Import ZIP", value: "import" },
            ]}
            size="md"
            radius="md"
            color="blue"
            style={{ maxWidth: 300 }}
          />
        )}

        {mode === "create" && creationMethod === "import" ? (
          <Stack gap="lg">
            <Card withBorder padding="lg" radius="md">
              <form onSubmit={handleImport}>
                <Stack gap="md">
                  <Title order={3} size="h4">
                    Import Problems from Archive
                  </Title>
                  <Text size="sm" c="dimmed">
                    Upload a ZIP archive containing problems structured in the GreenCode Problem Package format.
                  </Text>

                  <Divider my="xs" />

                  <Radio.Group
                    value={importType}
                    onChange={setImportType}
                    label="Import Type"
                    description="Choose whether the ZIP package contains a single problem or a bulk collection of problems"
                    required
                  >
                    <Group mt="xs" gap="xl">
                      <Radio value="single" label="Single Problem (problem.zip)" color="blue" />
                      <Radio value="bulk" label="Bulk Import (algorithms.zip)" color="blue" />
                    </Group>
                  </Radio.Group>

                  <FileInput
                    label="Problem ZIP Archive"
                    placeholder="Click to select or drag problem ZIP file"
                    accept=".zip"
                    leftSection={<IconFileZip size={16} />}
                    value={zipFile}
                    onChange={setZipFile}
                    required
                    clearable
                    mt="xs"
                  />

                  {importType === "single" ? (
                    <Alert icon={<IconInfoCircle size={16} />} title="Expected Single Folder Structure" color="blue" variant="light" mt="xs">
                      <Text size="xs" style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                        problem.zip{"\n"}
                        ├── problem.json      # Metadata (title, description, difficulty, tags){"\n"}
                        ├── checker.py        # Optional custom Python checker{"\n"}
                        └── tests/            # Tests directory{"\n"}
                            ├── input_1.txt   # Input testcase 1{"\n"}
                            ├── output_1.txt  # Output testcase 1{"\n"}
                            ├── input_2.txt{"\n"}
                            └── output_2.txt
                      </Text>
                      <Text size="xs" mt="sm">
                        * Note: <strong>checker.py</strong> is optional. If omitted, GreenCode uses default output comparison.
                      </Text>
                    </Alert>
                  ) : (
                    <Alert icon={<IconInfoCircle size={16} />} title="Expected Bulk Folder Structure" color="blue" variant="light" mt="xs">
                      <Text size="xs" style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                        algorithms.zip{"\n"}
                        ├── two-sum/{"\n"}
                        │   ├── problem.json{"\n"}
                        │   ├── checker.py    # Optional{"\n"}
                        │   └── tests/{"\n"}
                        │       ├── input_1.txt{"\n"}
                        │       └── output_1.txt{"\n"}
                        └── binary-search/{"\n"}
                            ├── problem.json{"\n"}
                            └── tests/
                      </Text>
                      <Text size="xs" mt="sm">
                        * Note: <strong>checker.py</strong> is optional for every problem in the archive.
                      </Text>
                    </Alert>
                  )}

                  <Group justify="end" mt="md">
                    <Button
                      type="submit"
                      color="blue"
                      leftSection={<IconUpload size={16} />}
                      loading={isLoading}
                      disabled={!zipFile}
                    >
                      Import Problems
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Card>

            {/* Results Panel */}
            {importResult && (
              <Card withBorder padding="lg" radius="md">
                <Stack gap="md">
                  <Title order={3} size="h4">
                    Import Summary
                  </Title>
                  <Group gap="md">
                    <Badge color="blue" size="lg">
                      Total: {importResult.summary.total}
                    </Badge>
                    <Badge color="green" size="lg">
                      Imported: {importResult.summary.imported}
                    </Badge>
                    <Badge color={importResult.summary.failed > 0 ? "red" : "gray"} size="lg">
                      Failed: {importResult.summary.failed}
                    </Badge>
                  </Group>

                  <Table verticalSpacing="sm" withTableBorder withColumnBorders mt="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ fontWeight: 600 }}>Problem / Folder</Table.Th>
                        <Table.Th style={{ width: 120, fontWeight: 600 }}>Status</Table.Th>
                        <Table.Th style={{ fontWeight: 600 }}>Details / Error</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {importResult.results.map((res, index) => (
                        <Table.Tr key={index}>
                          <Table.Td style={{ fontWeight: 600 }}>{res.title}</Table.Td>
                          <Table.Td>
                            <Badge
                              color={res.status === "imported" ? "green" : "red"}
                              leftSection={res.status === "imported" ? <IconCheck size={10} /> : <IconX size={10} />}
                            >
                              {res.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {res.status === "imported" ? (
                              <Text size="xs" c="green">
                                Problem successfully published
                              </Text>
                            ) : (
                              <Text size="xs" c="red">
                                {res.error}
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>

                  <Group justify="end" mt="md">
                    <Button
                      variant="light"
                      color="blue"
                      onClick={() => navigate("/problems")}
                    >
                      View Problems List
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
        ) : (
          <>
            <Stepper active={activeStep} onStepClick={setActiveStep} color="blue" size="sm">
              {/* Step 1: Basic Information */}
              <Stepper.Step label="Basic Information" description="Set Title and difficulty">
                <BasicInfoStep
                  title={title}
                  setTitle={setTitle}
                  difficulty={difficulty}
                  setDifficulty={setDifficulty}
                  tags={tags}
                  setTags={setTags}
                />
              </Stepper.Step>

              {/* Step 2: Markdown Description */}
              <Stepper.Step label="Description" description="Markdown workspace">
                <DescriptionStep
                  description={description}
                  setDescription={setDescription}
                  parsedDescription={getParsedDescription()}
                />
              </Stepper.Step>

              {/* Step 3: Examples */}
              <Stepper.Step label="Examples" description="Set visual examples">
                <ExamplesStep
                  testCases={testCases}
                  onAddExample={handleAddExample}
                  onRemoveExample={handleRemoveExample}
                  onExampleChange={handleExampleChange}
                />
              </Stepper.Step>

              {/* Step 4: Submission Files & Checker */}
              <Stepper.Step label="Submission Files" description={mode === "create" ? "Upload compilation cases" : "Manage custom checker"}>
                <UploadFilesStep
                  inputsFiles={inputsFiles}
                  outputsFiles={outputsFiles}
                  onDropInputs={handleDropInputs}
                  onDropOutputs={handleDropOutputs}
                  onRemoveInputFile={handleRemoveInputFile}
                  onRemoveOutputFile={handleRemoveOutputFile}
                  checkerFile={checkerFile}
                  onDropChecker={handleDropChecker}
                  onRemoveChecker={handleRemoveChecker}
                  existingChecker={existingChecker}
                  removeChecker={removeChecker}
                  onToggleRemoveExistingChecker={handleToggleRemoveExistingChecker}
                  mode={mode}
                />
              </Stepper.Step>

              {/* Step 5 / 4: Preview */}
              <Stepper.Step label="Preview" description="Verify challenge rendering">
                <PreviewStep
                  title={title}
                  difficulty={difficulty}
                  difficultyColor={getDifficultyColor(difficulty)}
                  parsedDescription={getParsedDescription()}
                  testCases={testCases}
                  tags={tags}
                />
              </Stepper.Step>

              {/* Final Step: Finish & Publish */}
              <Stepper.Completed>
                <CompletedStep mode={mode} />
              </Stepper.Completed>
            </Stepper>

            {/* Stepper Navigation Buttons */}
            <StepperNavigation
              activeStep={activeStep}
              mode={mode}
              isLoading={isLoading}
              onBack={prevStep}
              onNext={nextStep}
              onSave={handleSave}
            />
          </>
        )}
      </Stack>
    </Container>
  );
};

export default ProblemFormStepper;
