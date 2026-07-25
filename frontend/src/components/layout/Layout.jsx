import { useState } from "react";
import {
  AppShell,
  Group,
  Button,
  Text,
  Menu,
  Avatar,
  Badge,
  Box,
  Burger,
  Stack,
  ActionIcon,
  useMantineColorScheme,
  UnstyledButton,
  Container,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDisclosure } from "@mantine/hooks";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  IconLogout,
  IconTerminal2,
  IconChevronDown,
  IconPlus,
  IconList,
  IconSun,
  IconMoon,
  IconBookmark,
  IconChartBar,
  IconMailCheck,
  IconUsers,
} from "@tabler/icons-react";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, resendVerification } = useAuthStore();
  const [opened, { toggle, close }] = useDisclosure();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [isResending, setIsResending] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isDark = colorScheme === "dark";

  // Safe helper bindings for user settings to avoid TypeError crashes from stale/malformed session data
  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <AppShell
      header={{ height: 60, collapsed: { desktop: true } }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      styles={{
        main: {
          minHeight: "100vh",
          paddingBottom: "2rem",
          backgroundColor: "var(--mantine-color-body)",
        },
      }}
    >
      {/* Mobile Header */}
      <AppShell.Header px="md">
        <Group justify="between" h="100%">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />

          <Group
            component={Link}
            to="/"
            style={{ textDecoration: "none", color: "inherit" }}
            gap="xs"
          >
            <Avatar variant="filled" color="blue" radius="sm" size="sm">
              <IconTerminal2 size={18} />
            </Avatar>
            <Text size="lg" fw={800}>
              GreenCode
            </Text>
          </Group>

          <ActionIcon
            variant="default"
            onClick={() => toggleColorScheme()}
            size="lg"
            aria-label="Toggle color scheme"
          >
            {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      {/* Sidebar Navbar */}
      <AppShell.Navbar
        p="md"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Stack gap="md" style={{ flexGrow: 1 }}>
          {/* Logo & Theme Toggle Row */}
          <Group
            justify="space-between"
            pb="md"
            style={{
              borderBottom: "1px solid var(--mantine-color-default-border)",
            }}
          >
            <Group
              component={Link}
              to="/"
              onClick={close}
              style={{ textDecoration: "none", color: "inherit" }}
              gap="xs"
            >
              <Avatar variant="filled" color="blue" radius="sm" size="sm">
                <IconTerminal2 size={18} />
              </Avatar>
              <Text size="lg" fw={800}>
                GreenCode
              </Text>
            </Group>

            <ActionIcon
              variant="default"
              onClick={() => toggleColorScheme()}
              size="lg"
              aria-label="Toggle color scheme"
            >
              {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Group>

          {/* Navigation Links */}
          <Stack gap="xs" mt="md">
            <Button
              variant={
                location.pathname.startsWith("/problems") &&
                !location.pathname.includes("create") &&
                !location.pathname.includes("edit")
                  ? "light"
                  : "subtle"
              }
              color="blue"
              component={Link}
              to="/problems"
              onClick={close}
              leftSection={<IconList size={16} />}
              justify="start"
              fullWidth
              size="md"
            >
              Problems
            </Button>

            <Button
              variant={location.pathname === "/stats" ? "light" : "subtle"}
              color="blue"
              component={Link}
              to="/stats"
              onClick={close}
              leftSection={<IconChartBar size={16} />}
              justify="start"
              fullWidth
              size="md"
            >
              Statistics
            </Button>

            <Button
              variant={
                location.pathname.startsWith("/userlists") ? "light" : "subtle"
              }
              color="blue"
              component={Link}
              to="/userlists"
              onClick={close}
              leftSection={<IconBookmark size={16} />}
              justify="start"
              fullWidth
              size="md"
            >
              My Lists
            </Button>

            {user && user?.role === "admin" && (
              <>
                <Button
                  variant={
                    location.pathname === "/problems/create" ? "light" : "subtle"
                  }
                  color="blue"
                  component={Link}
                  to="/problems/create"
                  onClick={close}
                  leftSection={<IconPlus size={16} />}
                  justify="start"
                  fullWidth
                  size="md"
                >
                  Create Problem
                </Button>

                <Button
                  variant={location.pathname === "/users" ? "light" : "subtle"}
                  color="blue"
                  component={Link}
                  to="/users"
                  onClick={close}
                  leftSection={<IconUsers size={16} />}
                  justify="start"
                  fullWidth
                  size="md"
                >
                  Users
                </Button>
              </>
            )}
          </Stack>
        </Stack>

        {/* Profile / User section anchored to bottom of navbar */}
        <Box
          pt="md"
          style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
        >
          {user ? (
            <Menu shadow="md" width={220} position="top-start" offset={8}>
              <Menu.Target>
                <UnstyledButton style={{ width: "100%" }}>
                  <Group
                    justify="between"
                    gap="xs"
                    p="xs"
                    style={{
                      borderRadius: "var(--mantine-radius-md)",
                      transition: "background-color 0.2s",
                    }}
                    className="profile-button"
                  >
                    <Group gap="xs" style={{ minWidth: 0, flexGrow: 1 }}>
                      <Avatar color="blue" radius="xl" size="md">
                        {initial}
                      </Avatar>
                      <Box style={{ minWidth: 0, flexGrow: 1 }}>
                        <Text size="sm" fw={600} truncate>
                          {displayName}
                        </Text>
                        <Text size="xs" color="dimmed" truncate>
                          {displayEmail}
                        </Text>
                      </Box>
                    </Group>
                    <IconChevronDown
                      size={14}
                      style={{
                        color: "var(--mantine-color-dimmed)",
                        flexShrink: 0,
                      }}
                    />
                  </Group>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Logged in as</Menu.Label>
                <Menu.Item disabled>
                  <Text
                    size="xs"
                    fw={600}
                    truncate
                    style={{ color: "var(--mantine-color-text)", display: "block", maxWidth: 190 }}
                  >
                    {displayEmail}
                  </Text>
                  {user?.role === "admin" && (
                    <Badge color="red" size="xs" variant="filled" mt={4}>
                      Admin
                    </Badge>
                  )}
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={14} />}
                  onClick={handleLogout}
                >
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Stack gap="xs">
              <Button
                variant="subtle"
                color="gray"
                component={Link}
                to="/login"
                onClick={close}
                fullWidth
              >
                Sign In
              </Button>
              <Button
                color="blue"
                component={Link}
                to="/register"
                onClick={close}
                fullWidth
              >
                Sign Up
              </Button>
            </Stack>
          )}
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" pt="md" h="100%">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
};

export default Layout;
