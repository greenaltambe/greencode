import { Card, Text, Group, Box, Badge, Anchor, Stack } from "@mantine/core";
import { IconCircleCheck, IconCircleX, IconArrowRight } from "@tabler/icons-react";
import { Link } from "react-router-dom";

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const getDifficultyColor = (diff) => {
  if (!diff) return "gray";
  const d = diff.toLowerCase();
  if (d === "easy") return "teal";
  if (d === "medium") return "orange";
  if (d === "hard") return "red";
  return "gray";
};

const getLanguageColor = (lang) => {
  const l = lang ? lang.toLowerCase() : "";
  if (l.includes("python")) return "blue";
  if (l.includes("c++") || l.includes("cpp")) return "red";
  if (l.includes("java") && !l.includes("script")) return "orange";
  if (l.includes("javascript") || l.includes("js") || l.includes("node")) return "yellow";
  return "indigo";
};

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

const RecentActivity = ({ activity }) => {
  const submissions = activity || [];

  return (
    <Card shadow="xs" radius="md" p="xl" withBorder style={{ height: "100%" }}>
      <Text fw={700} size="lg" mb="md">
        Recent Activity
      </Text>

      {submissions.length === 0 ? (
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
            minHeight: "150px",
          }}
        >
          <Text c="dimmed" size="sm">
            No recent activity. Solve some problems to get started!
          </Text>
        </Box>
      ) : (
        <Stack gap="xs" style={{ maxHeight: "400px", overflowY: "auto" }}>
          {submissions.map((sub, idx) => {
            const isAccepted = sub.status === "accepted";
            const problemTitle = sub.problem?.title || "Deleted Problem";
            const problemId = sub.problem?._id;
            const diff = sub.problem?.difficulty;

            return (
              <Box
                key={sub._id || idx}
                p="xs"
                style={{
                  borderRadius: "var(--mantine-radius-md)",
                  border: "1px solid var(--mantine-color-default-border)",
                  backgroundColor: "var(--mantine-color-default-hover)",
                  transition: "background-color 0.2s",
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    <Box style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      {isAccepted ? (
                        <IconCircleCheck size={20} style={{ color: "var(--mantine-color-teal-filled)" }} />
                      ) : (
                        <IconCircleX size={20} style={{ color: "var(--mantine-color-red-filled)" }} />
                      )}
                    </Box>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" wrap="nowrap">
                        {problemId ? (
                          <Anchor
                            component={Link}
                            to={`/problems/${problemId}`}
                            fw={600}
                            size="sm"
                            truncate
                            c="var(--mantine-color-text)"
                            underline="hover"
                          >
                            {problemTitle}
                          </Anchor>
                        ) : (
                          <Text fw={600} size="sm" c="dimmed" truncate>
                            {problemTitle}
                          </Text>
                        )}
                        {diff && (
                          <Badge variant="outline" color={getDifficultyColor(diff)} size="xs">
                            {diff}
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" mt={2} fw={500}>
                        {formatRelativeTime(sub.createdAt)}
                        {sub.executionTime !== undefined && sub.executionTime !== null && sub.executionTime > 0 && ` • ${sub.executionTime} ms`}
                        {sub.memoryUsage !== undefined && sub.memoryUsage !== null && sub.memoryUsage > 0 && ` • ${(sub.memoryUsage / 1024 / 1024).toFixed(2)} MB`}
                      </Text>
                    </Box>
                  </Group>

                  <Group gap="xs" wrap="nowrap">
                    <Badge variant="light" color={getLanguageColor(sub.language)} size="xs">
                      {sub.language}
                    </Badge>
                    {isAccepted ? (
                      <Badge variant="filled" color="teal" size="xs">
                        Accepted
                      </Badge>
                    ) : sub.status === "queued" || sub.status === "running" ? (
                      <Badge variant="outline" color="gray" size="xs">
                        {getVerdictLabel(sub.status)}
                      </Badge>
                    ) : (
                      <Badge variant="filled" color="red" size="xs">
                        {getVerdictLabel(sub.status)}
                      </Badge>
                    )}
                  </Group>
                </Group>
              </Box>
            );
          })}
        </Stack>
      )}
    </Card>
  );
};

export default RecentActivity;
