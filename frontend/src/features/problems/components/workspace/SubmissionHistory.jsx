import { ScrollArea, Stack, Card, Group, Badge, Text } from "@mantine/core";
import { IconCheck, IconX, IconTerminal } from "@tabler/icons-react";

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

const SubmissionHistory = ({ submissions, onOpenSubmissionCode }) => {
  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString() +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <ScrollArea h="100%" p="md">
      {submissions && submissions.length > 0 ? (
        <Stack gap="sm">
          {submissions.map((sub) => (
            <Card
              key={sub._id}
              p="md"
              withBorder
              style={{
                cursor: "pointer",
              }}
              onClick={() => onOpenSubmissionCode(sub)}
            >
              <Group justify="between">
                <Group gap="sm">
                  {sub.status === "accepted" ? (
                    <Badge color="teal" leftSection={<IconCheck size={12} />}>
                      Accepted
                    </Badge>
                  ) : sub.status === "queued" || sub.status === "running" ? (
                    <Badge color="gray" variant="outline">
                      {getVerdictLabel(sub.status)}
                    </Badge>
                  ) : (
                    <Badge color="red" leftSection={<IconX size={12} />}>
                      {getVerdictLabel(sub.status)}
                    </Badge>
                  )}
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{ textTransform: "uppercase" }}
                  >
                    {sub.language}
                  </Text>
                  {sub.executionTime !== undefined && sub.executionTime !== null && sub.executionTime > 0 && (
                    <Text size="xs" c="dimmed">
                      • {sub.executionTime} ms
                    </Text>
                  )}
                  {sub.memoryUsage !== undefined && sub.memoryUsage !== null && sub.memoryUsage > 0 && (
                    <Text size="xs" c="dimmed">
                      • {(sub.memoryUsage / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {formatTime(sub.createdAt)}
                </Text>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : (
        <Stack align="center" justify="center" h="100%" py={100} gap="xs">
          <IconTerminal
            size={32}
            style={{ color: "var(--mantine-color-dimmed)" }}
          />
          <Text c="dimmed" size="sm">
            No submissions yet for this problem.
          </Text>
        </Stack>
      )}
    </ScrollArea>
  );
};

export default SubmissionHistory;
