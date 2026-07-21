import { Card, Box, Group, Button } from "@mantine/core";
import Editor from "@monaco-editor/react";
import { IconPlayerPlay, IconCloudUpload } from "@tabler/icons-react";

const CodeEditor = ({
  language,
  theme,
  code,
  onCodeChange,
  fontSize,
  wordWrap,
  minimap,
  autocomplete,
  onRun,
  onSubmit,
  isSubmissionLoading,
}) => {
  return (
    <Card
      h="100%"
      p={0}
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          flexGrow: 1,
          position: "relative",
          minHeight: 0,
        }}
      >
        <Editor
          height="100%"
          language={
            language === "cpp"
              ? "cpp"
              : language === "java"
                ? "java"
                : "python"
          }
          theme={theme}
          value={code}
          onChange={onCodeChange}
          options={{
            fontSize: fontSize,
            wordWrap: wordWrap ? "on" : "off",
            minimap: { enabled: minimap },
            quickSuggestions: {
              other: autocomplete,
              comments: autocomplete,
              strings: autocomplete,
            },
            suggestOnTriggerCharacters: autocomplete,
            lineNumbers: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
      </Box>

      {/* Action Panel Footer */}
      <Group
        justify="end"
        p="xs"
        style={{
          backgroundColor: "var(--mantine-color-default-hover)",
          borderTop: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconPlayerPlay size={16} />}
          onClick={onRun}
          disabled={isSubmissionLoading}
        >
          Run Code
        </Button>
        <Button
          color="blue"
          leftSection={<IconCloudUpload size={16} />}
          onClick={onSubmit}
          loading={isSubmissionLoading}
          disabled={isSubmissionLoading}
        >
          Submit
        </Button>
      </Group>
    </Card>
  );
};

export default CodeEditor;
