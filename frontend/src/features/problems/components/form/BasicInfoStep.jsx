import { Card, Select, Stack, TextInput, MultiSelect } from "@mantine/core";
import { PROBLEM_TAGS, TAG_CATEGORIES } from "../../data/problemTags.js";

const BasicInfoStep = ({ title, setTitle, difficulty, setDifficulty, tags, setTags }) => {
  const selectData = TAG_CATEGORIES.map((category) => ({
    group: category,
    items: PROBLEM_TAGS.filter((tag) => tag.category === category).map((tag) => ({
      value: tag.id,
      label: tag.label,
    })),
  })).filter((group) => group.items.length > 0);

  return (
    <Card mt="xl" p="lg" withBorder radius="md">
      <Stack gap="md">
        <TextInput
          label="Problem Title"
          placeholder="e.g. FizzBuzz, Add Two Numbers"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Difficulty Rating"
          value={difficulty}
          onChange={(value) => setDifficulty(value || "easy")}
          data={[
            {
              label: "Easy",
              value: "easy",
            },
            {
              label: "Medium",
              value: "medium",
            },
            {
              label: "Hard",
              value: "hard",
            },
          ]}
        />

        <MultiSelect
          label="Problem Tags"
          placeholder="Select one or more tags (e.g. Array, DFS)"
          data={selectData}
          value={tags}
          onChange={setTags}
          searchable
          clearable
          nothingFoundMessage="No tags found"
        />
      </Stack>
    </Card>
  );
};

export default BasicInfoStep;
