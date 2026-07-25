import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";

import { useAuthStore } from "../../../stores/authStore";
import TerminalPreview from "./TerminalPreview";

const HeroSection = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <Container size="xl" pt={{ base: 60, md: 100 }} pb={60}>
      <Stack align="center" gap="xl" style={{ textAlign: "center" }}>
        <Title
          order={1}
          style={{
            fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
            lineHeight: 1.1,
            fontWeight: 900,
            letterSpacing: "-1.5px",
            maxWidth: 900,
          }}
        >
          The Professional{" "}
          <span
            style={{
              background:
                "linear-gradient(135deg, var(--mantine-color-blue-4) 0%, var(--mantine-color-blue-7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Coding Sandbox
          </span>{" "}
          for Developers
        </Title>

        <Text
          size="lg"
          c="dimmed"
          maw={650}
          mx="auto"
          style={{
            fontSize: "1.2rem",
            lineHeight: 1.6,
          }}
        >
          Run, compile, and submit code against real-world test cases. Empower
          your coding journey with an integrated Monaco workspace, blazing fast
          execution, and modern design.
        </Text>

        <Group gap="md" justify="center" mt="md">
          <Button
            size="lg"
            color="blue"
            component={Link}
            to={user ? "/problems" : "/register"}
            rightSection={<IconArrowRight size={18} />}
            style={{
              transition: "transform 0.2s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "translateY(-2px)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "translateY(0)")
            }
          >
            Start Coding Now
          </Button>

          <Button
            size="lg"
            variant="outline"
            color="gray"
            component={Link}
            to="/problems"
          >
            Browse Problems
          </Button>
        </Group>

        <TerminalPreview />
      </Stack>
    </Container>
  );
};

export default HeroSection;
