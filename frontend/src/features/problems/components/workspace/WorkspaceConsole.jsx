import {
  Card,
  Tabs,
  Box,
  Group,
  Stack,
  LoadingOverlay,
  Text,
  Grid,
  ScrollArea,
  Badge,
} from "@mantine/core";
import { IconTerminal, IconCheck, IconX } from "@tabler/icons-react";

const getVerdictLabel = (status) => {
  if (status === "accepted") return "Accepted";
  if (status === "wrong_answer") return "Wrong Answer";
  if (status === "compile_error") return "Compile Error";
  if (status === "runtime_error") return "Runtime Error";
  if (status === "time_limit_exceeded") return "Time Limit Exceeded";
  if (status === "memory_limit_exceeded") return "Memory Limit Exceeded";
  if (status === "internal_error") return "Internal Error";
  if (status === "running") return "Running";
  if (status === "queued") return "Queued";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Rejected";
};

const WorkspaceConsole = ({
  consoleTab,
  onTabChange,
  isSubmissionLoading,
  runResult,
  activeTestCaseIndex,
  setActiveTestCaseIndex,
  submissionResult,
  activeSubmissionCaseIndex,
  setActiveSubmissionCaseIndex,
}) => {
  return (
    <Card
      h="100%"
      p={0}
      withBorder
      style={{ display: "flex", flexDirection: "column" }}
    >
      <Tabs
        value={consoleTab}
        onChange={onTabChange}
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
          <Tabs.Tab value="run" leftSection={<IconTerminal size={14} />}>
            Console Run Results
          </Tabs.Tab>
          <Tabs.Tab value="submit" leftSection={<IconCheck size={14} />}>
            Submission Results
          </Tabs.Tab>
        </Tabs.List>

        <Box style={{ flexGrow: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Run Results Tab */}
          <Tabs.Panel value="run" h="100%">
            {isSubmissionLoading && consoleTab === "run" ? (
              <Group justify="center" align="center" h="100%">
                <Stack align="center" gap="xs">
                  <LoadingOverlay
                    visible
                    overlayProps={{ blur: 0, color: "transparent" }}
                  />
                  <Text size="sm" c="dimmed" mt={40}>
                    Executing compiler tests...
                  </Text>
                </Stack>
              </Group>
            ) : runResult && runResult.response ? (
              <Grid gutter={0} h="100%" style={{ display: "flex" }}>
                {/* Case list selector */}
                <Grid.Col
                  span={3}
                  style={{
                    borderRight: "1px solid var(--mantine-color-default-border)",
                    backgroundColor: "var(--mantine-color-default-hover)",
                    height: "100%",
                  }}
                >
                  <ScrollArea h="100%">
                    <Stack gap={0}>
                      {runResult.response.map((tc, idx) => (
                        <Box
                          key={idx}
                          onClick={() => setActiveTestCaseIndex(idx)}
                          p="sm"
                          style={{
                            cursor: "pointer",
                            backgroundColor:
                              activeTestCaseIndex === idx
                                ? "var(--mantine-color-default)"
                                : "transparent",
                            borderLeft:
                              activeTestCaseIndex === idx
                                ? "3px solid var(--mantine-color-blue-filled)"
                                : "3px solid transparent",
                          }}
                        >
                          <Group gap="xs">
                            {tc.passed ? (
                              <IconCheck
                                size={14}
                                style={{
                                  color: "var(--mantine-color-teal-filled)",
                                }}
                              />
                            ) : (
                              <IconX
                                size={14}
                                style={{
                                  color: "var(--mantine-color-red-filled)",
                                }}
                              />
                            )}
                            <Text
                              size="sm"
                              fw={activeTestCaseIndex === idx ? 700 : 500}
                              color={tc.passed ? "teal" : "red"}
                            >
                              Case {idx + 1}
                            </Text>
                          </Group>
                        </Box>
                      ))}
                    </Stack>
                  </ScrollArea>
                </Grid.Col>

                {/* Case detailed report */}
                <Grid.Col span={9} style={{ height: "100%" }}>
                  <ScrollArea h="100%" p="md">
                    {runResult.response[activeTestCaseIndex] && (
                      <Stack gap="sm">
                        <Group justify="between">
                          <Text fw={700} size="sm">
                            Case Details
                          </Text>
                          {runResult.response[activeTestCaseIndex].passed ? (
                            <Badge color="teal" size="sm">
                              Passed
                            </Badge>
                          ) : (
                            <Badge color="red" size="sm">
                              Failed
                            </Badge>
                          )}
                        </Group>

                        <div>
                          <Text size="xs" c="dimmed" mb={4}>
                            INPUT
                          </Text>
                          <Box
                            p="xs"
                            style={{
                              backgroundColor: "var(--mantine-color-default-hover)",
                              border: "1px solid var(--mantine-color-default-border)",
                              borderRadius: "var(--mantine-radius-sm)",
                              fontFamily: "var(--mantine-font-monospace)",
                              fontSize: "0.8rem",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {runResult.response[activeTestCaseIndex].input}
                          </Box>
                        </div>

                        <div>
                          <Text size="xs" c="dimmed" mb={4}>
                            EXPECTED OUTPUT
                          </Text>
                          <Box
                            p="xs"
                            style={{
                              backgroundColor: "var(--mantine-color-default-hover)",
                              border: "1px solid var(--mantine-color-default-border)",
                              borderRadius: "var(--mantine-radius-sm)",
                              fontFamily: "var(--mantine-font-monospace)",
                              fontSize: "0.8rem",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {runResult.response[activeTestCaseIndex].expectedOutput}
                          </Box>
                        </div>

                        <div>
                          <Text
                            size="xs"
                            color={
                              runResult.response[activeTestCaseIndex].passed
                                ? "dimmed"
                                : "red"
                            }
                            mb={4}
                          >
                            ACTUAL OUTPUT
                          </Text>
                          <Box
                            p="xs"
                            style={{
                              backgroundColor: "var(--mantine-color-default-hover)",
                              border: "1px solid var(--mantine-color-default-border)",
                              borderRadius: "var(--mantine-radius-sm)",
                              fontFamily: "var(--mantine-font-monospace)",
                              fontSize: "0.8rem",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {runResult.response[activeTestCaseIndex].output}
                          </Box>
                        </div>
                      </Stack>
                    )}
                  </ScrollArea>
                </Grid.Col>
              </Grid>
            ) : (
              <Stack align="center" justify="center" h="100%" gap="xs">
                <IconTerminal
                  size={24}
                  style={{ color: "var(--mantine-color-dimmed)" }}
                />
                <Text c="dimmed" size="xs">
                  Click 'Run Code' to test your solution.
                </Text>
              </Stack>
            )}
          </Tabs.Panel>

          {/* Submit Results Tab */}
          <Tabs.Panel value="submit" h="100%">
            {isSubmissionLoading && consoleTab === "submit" ? (
              <Group justify="center" align="center" h="100%">
                <Stack align="center" gap="xs">
                  <LoadingOverlay
                    visible
                    overlayProps={{ blur: 0, color: "transparent" }}
                  />
                  <Text size="sm" c="dimmed" mt={40}>
                    {submissionResult && submissionResult.status === "queued"
                      ? "Queued in queue, waiting for worker..."
                      : submissionResult && submissionResult.status === "running"
                      ? "Evaluating solution in Docker sandbox..."
                      : "Submitting to Sandbox Judgement..."}
                  </Text>
                </Stack>
              </Group>
            ) : submissionResult ? (
              <Grid gutter={0} h="100%" style={{ display: "flex" }}>
                {/* Left index */}
                <Grid.Col
                  span={3}
                  style={{
                    borderRight: "1px solid var(--mantine-color-default-border)",
                    backgroundColor: "var(--mantine-color-default-hover)",
                    height: "100%",
                  }}
                >
                  <ScrollArea h="100%">
                    <Box
                      p="sm"
                      style={{
                        borderBottom: "1px solid var(--mantine-color-default-border)",
                      }}
                    >
                      <Text size="xs" c="dimmed">
                        SUBMISSION VERDICT
                      </Text>
                      <Badge
                        color={
                          submissionResult.status === "accepted"
                            ? "teal"
                            : submissionResult.status === "queued" || submissionResult.status === "running"
                            ? "gray"
                            : "red"
                        }
                        variant={
                          submissionResult.status === "queued" || submissionResult.status === "running"
                            ? "outline"
                            : "filled"
                        }
                        fullWidth
                        size="md"
                        mt={5}
                      >
                        {getVerdictLabel(submissionResult.status)}
                      </Badge>
                      {((submissionResult.executionTime && submissionResult.executionTime > 0) ||
                        (submissionResult.memoryUsage && submissionResult.memoryUsage > 0)) && (
                        <Box mt="md" style={{ borderTop: "1px dashed var(--mantine-color-default-border)", paddingTop: "8px" }}>
                          <Group justify="space-between" mb={4}>
                            <Text size="xs" c="dimmed" fw={500}>
                              Time:
                            </Text>
                            <Text size="xs" fw={700}>
                              {submissionResult.executionTime} ms
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed" fw={500}>
                              Memory:
                            </Text>
                            <Text size="xs" fw={700}>
                              {(submissionResult.memoryUsage / 1024 / 1024).toFixed(2)} MB
                            </Text>
                          </Group>
                        </Box>
                      )}
                    </Box>
                    <Stack gap={0}>
                      {submissionResult.results &&
                        submissionResult.results.map((tc, idx) => (
                          <Box
                            key={idx}
                            onClick={() => setActiveSubmissionCaseIndex(idx)}
                            p="sm"
                            style={{
                              cursor: "pointer",
                              backgroundColor:
                                activeSubmissionCaseIndex === idx
                                  ? "var(--mantine-color-default)"
                                  : "transparent",
                              borderLeft:
                                activeSubmissionCaseIndex === idx
                                  ? "3px solid var(--mantine-color-blue-filled)"
                                  : "3px solid transparent",
                            }}
                          >
                            <Group gap="xs">
                              {tc.passed ? (
                                <IconCheck
                                  size={14}
                                  style={{
                                    color: "var(--mantine-color-teal-filled)",
                                  }}
                                />
                              ) : (
                                <IconX
                                  size={14}
                                  style={{
                                    color: "var(--mantine-color-red-filled)",
                                  }}
                                />
                              )}
                              <Text
                                size="sm"
                                fw={activeSubmissionCaseIndex === idx ? 700 : 500}
                              >
                                Test Case {idx + 1}
                              </Text>
                            </Group>
                          </Box>
                        ))}
                    </Stack>
                  </ScrollArea>
                </Grid.Col>

                {/* Right details */}
                <Grid.Col span={9} style={{ height: "100%" }}>
                  <ScrollArea h="100%" p="md">
                    {submissionResult.results &&
                    submissionResult.results[activeSubmissionCaseIndex] ? (
                      <Stack gap="sm">
                        <Text fw={700} size="sm">
                          Sandbox Logs
                        </Text>

                        <div>
                          <Text size="xs" c="dimmed" mb={4}>
                            INPUT
                          </Text>
                          <Box
                            p="xs"
                            style={{
                              backgroundColor: "var(--mantine-color-default-hover)",
                              border: "1px solid var(--mantine-color-default-border)",
                              borderRadius: "var(--mantine-radius-sm)",
                              fontFamily: "var(--mantine-font-monospace)",
                              fontSize: "0.8rem",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {submissionResult.results[activeSubmissionCaseIndex].input}
                          </Box>
                        </div>

                        <div>
                          <Text size="xs" c="dimmed" mb={4}>
                            EXPECTED OUTPUT
                          </Text>
                          <Box
                            p="xs"
                            style={{
                              backgroundColor: "var(--mantine-color-default-hover)",
                              border: "1px solid var(--mantine-color-default-border)",
                              borderRadius: "var(--mantine-radius-sm)",
                              fontFamily: "var(--mantine-font-monospace)",
                              fontSize: "0.8rem",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {submissionResult.results[activeSubmissionCaseIndex].expectedOutput}
                          </Box>
                        </div>

                        <div>
                          <Text
                            size="xs"
                            color={
                              submissionResult.results[activeSubmissionCaseIndex].passed
                                ? "dimmed"
                                : "red"
                            }
                            mb={4}
                          >
                            ACTUAL RUNTIME OUTPUT
                          </Text>
                          <Box
                            p="xs"
                            style={{
                              backgroundColor: "var(--mantine-color-default-hover)",
                              border: "1px solid var(--mantine-color-default-border)",
                              borderRadius: "var(--mantine-radius-sm)",
                              fontFamily: "var(--mantine-font-monospace)",
                              fontSize: "0.8rem",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {submissionResult.results[activeSubmissionCaseIndex].output}
                          </Box>
                        </div>
                      </Stack>
                    ) : (
                      <Text c="dimmed" size="xs" p="md">
                        All cases executed successfully.
                      </Text>
                    )}
                  </ScrollArea>
                </Grid.Col>
              </Grid>
            ) : (
              <Stack align="center" justify="center" h="100%" gap="xs">
                <IconTerminal
                  size={24}
                  style={{ color: "var(--mantine-color-dimmed)" }}
                />
                <Text c="dimmed" size="xs">
                  Submit solution to trigger database logs verdict.
                </Text>
              </Stack>
            )}
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Card>
  );
};

export default WorkspaceConsole;
