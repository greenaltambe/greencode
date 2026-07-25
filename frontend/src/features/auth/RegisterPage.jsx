import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Container,
  Grid,
  Card,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Group,
  ThemeIcon,
  Box,
  SegmentedControl,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuthStore } from "../../stores/authStore";
import {
  IconTerminal2,
  IconLock,
  IconMail,
  IconUser,
  IconArrowRight,
} from "@tabler/icons-react";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, user, isLoading, isError, isSuccess, message, reset } =
    useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/problems");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (isSuccess) {
      notifications.show({
        title: "Registration Successful",
        message: "Your new GreenCode account is ready!",
        color: "blue",
      });
      reset();
      navigate("/problems");
    }

    if (isError) {
      notifications.show({
        title: "Registration Failed",
        message:
          message || "Invalid registration information, please try again.",
        color: "red",
      });
      reset();
    }
  }, [isSuccess, isError, message, reset, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      notifications.show({
        title: "Error",
        message: "Please fill in all fields",
        color: "red",
      });
      return;
    }
    register({ name, email, password });
  };

  return (
    <Box
      style={{
        backgroundColor: "var(--mantine-color-body)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container size="xl" style={{ width: "100%" }}>
        <Grid gutter={80} align="center" justify="center">
          {/* Form Column */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Card p="xl" radius="md" withBorder>
              {/* Logo / Branding */}
              <Group gap="xs" mb="lg">
                <ThemeIcon variant="filled" color="blue" radius="sm">
                  <IconTerminal2 size={18} />
                </ThemeIcon>
                <Text
                  size="lg"
                  fw={800}
                  style={{
                    letterSpacing: "-0.5px",
                    background:
                      "linear-gradient(135deg, var(--mantine-color-blue-4) 0%, var(--mantine-color-blue-7) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  GreenCode
                </Text>
              </Group>

              <Title order={2} mb={4}>
                Create Profile
              </Title>
              <Text size="sm" color="dimmed" mb="xl">
                Get instant access to coding sandbox.
              </Text>

              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <TextInput
                    label="Full Name"
                    placeholder="John Doe"
                    required
                    leftSection={<IconUser size={16} />}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  <TextInput
                    label="Email address"
                    placeholder="you@example.com"
                    required
                    leftSection={<IconMail size={16} />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <PasswordInput
                    label="Password"
                    placeholder="At least 6 characters"
                    required
                    leftSection={<IconLock size={16} />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />



                  <Button
                    type="submit"
                    color="blue"
                    fullWidth
                    loading={isLoading}
                    rightSection={<IconArrowRight size={16} />}
                    mt="md"
                  >
                    Get Started
                  </Button>
                </Stack>
              </form>

              <Text
                size="sm"
                color="dimmed"
                mt="xl"
                style={{ textAlign: "center" }}
              >
                Already have an account?{" "}
                <Link
                  to="/login"
                  style={{
                    color: "var(--mantine-color-blue-filled)",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Sign In
                </Link>
              </Text>
            </Card>
          </Grid.Col>

          {/* Code/Design Illustration Column */}
          <Grid.Col span={{ base: 12, md: 7 }} visibleFrom="md">
            <Box
              style={{
                borderRadius: "12px",
                border: "1px solid var(--mantine-color-default-border)",
                backgroundColor: "var(--mantine-color-default-hover)",
                padding: "2.5rem",
                boxShadow: "var(--mantine-shadow-md)",
              }}
            >
              <Group mb="lg" gap="xs">
                <Box
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#ef4444",
                  }}
                />
                <Box
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#eab308",
                  }}
                />
                <Box
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#22c55e",
                  }}
                />
                <Text
                  size="xs"
                  color="dimmed"
                  style={{ fontFamily: "var(--mantine-font-monospace)" }}
                  ml={8}
                >
                  sandbox_init.cpp
                </Text>
              </Group>

              <Box
                style={{
                  fontFamily: "var(--mantine-font-monospace)",
                  fontSize: "0.9rem",
                  color: "var(--mantine-color-text)",
                  lineHeight: 1.6,
                }}
              >
                <Text style={{ color: "var(--mantine-color-blue-filled)" }}>
                  #include{" "}
                  <span style={{ color: "var(--mantine-color-indigo-filled)" }}>
                    &lt;greencode.h&gt;
                  </span>
                </Text>
                <Text>&nbsp;</Text>
                <Text color="blue">int main() &#123;</Text>
                <Text>&nbsp;&nbsp;&nbsp;&nbsp;Coder new_user;</Text>
                <Text>
                  &nbsp;&nbsp;&nbsp;&nbsp;new_user.set_level(LEVEL_BEGINNER);
                </Text>
                <Text>&nbsp;&nbsp;&nbsp;&nbsp;new_user.unlock_sandbox();</Text>
                <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
                <Text>
                  &nbsp;&nbsp;&nbsp;&nbsp;
                  <span style={{ color: "#f43f5e" }}>if</span>{" "}
                  (new_user.is_authorized()) &#123;
                </Text>
                <Text>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;std::cout
                  &lt;&lt;{" "}
                  <span style={{ color: "var(--mantine-color-red-filled)" }}>
                    "Access Granted"
                  </span>{" "}
                  &lt;&lt; std::endl;
                </Text>
                <Text>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;new_user.compile_and_run();
                </Text>
                <Text>&nbsp;&nbsp;&nbsp;&nbsp;&#125;</Text>
                <Text>&nbsp;&nbsp;&nbsp;&nbsp;return 0;</Text>
                <Text color="blue">&#125;</Text>
              </Box>
            </Box>
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  );
};

export default RegisterPage;
