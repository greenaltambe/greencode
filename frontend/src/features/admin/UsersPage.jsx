import { useEffect, useState } from "react";
import {
  Container,
  Stack,
  Title,
  Text,
  TextInput,
  Table,
  Badge,
  Button,
  Group,
  Card,
  Loader,
  Avatar,
  Box,
  Alert,
  ThemeIcon,
  Pagination,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconSearch,
  IconUsers,
  IconShield,
  IconMailCheck,
  IconMailX,
  IconUserCheck,
} from "@tabler/icons-react";
import api from "../../lib/api";

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [isLoading, setIsLoading] = useState(false);
  const [promotingId, setPromotingId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const fetchUsers = async (query = "", pageNum = 1) => {
    setIsLoading(true);
    try {
      const response = await api.get(
        `/admin/users?search=${encodeURIComponent(query)}&page=${pageNum}&limit=10`
      );
      if (response.data && response.data.users) {
        setUsers(response.data.users);
        setTotalPages(response.data.totalPages || 1);
        setTotalUsers(response.data.totalUsers || 0);
      }
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Error fetching users",
        message: error.response?.data?.message || "Could not connect to the server",
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(debouncedSearch, page);
  }, [debouncedSearch, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handlePromote = async (userId, userEmail) => {
    setPromotingId(userId);
    try {
      const response = await api.post(`/admin/users/${userId}/promote`);
      if (response.data && response.data.success) {
        notifications.show({
          title: "User Promoted",
          message: `${userEmail} has been elevated to Admin successfully!`,
          color: "teal",
          icon: <IconUserCheck size={16} />,
        });
        // Refresh users list
        fetchUsers(search, page);
      }
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Promotion Failed",
        message: error.response?.data?.message || "An error occurred during user promotion",
        color: "red",
      });
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <Container size="xl" py="lg">
      <Stack gap="xl">
        {/* Page Header */}
        <Box>
          <Group justify="between" align="center" mb="xs">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: "blue", to: "cyan" }}>
                <IconUsers size={20} />
              </ThemeIcon>
              <Title
                order={1}
                style={{
                  background: "linear-gradient(135deg, var(--mantine-color-blue-4) 0%, var(--mantine-color-blue-7) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Users Directory
              </Title>
            </Group>
            <Badge size="lg" variant="light" color="blue">
              {totalUsers} {totalUsers === 1 ? "user" : "users"} found
            </Badge>
          </Group>
          <Text size="sm" color="dimmed">
            Manage user accounts, monitor registration status, and promote verified accounts to administrators.
          </Text>
        </Box>

        {/* Search & Actions Card */}
        <Card p="md" radius="md" withBorder shadow="sm">
          <TextInput
            placeholder="Search by name or email address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<IconSearch size={16} />}
            size="md"
            radius="md"
            rightSection={isLoading ? <Loader size="xs" /> : null}
          />
        </Card>

        {/* Directory Listing */}
        {users.length === 0 && !isLoading ? (
          <Alert color="blue" title="No Users Found" icon={<IconUsers size={16} />}>
            No user accounts match your search query. Try clearing the search bar or typing a different keyword.
          </Alert>
        ) : (
          <Card p={0} radius="md" withBorder shadow="sm" style={{ overflow: "hidden" }}>
            <Table highlightOnHover verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead style={{ backgroundColor: "var(--mantine-color-gray-light)" }}>
                <Table.Tr>
                  <Table.Th style={{ width: "300px" }}>User Info</Table.Th>
                  <Table.Th>Email Address</Table.Th>
                  <Table.Th style={{ width: "160px" }}>Verification Status</Table.Th>
                  <Table.Th style={{ width: "140px" }}>Role</Table.Th>
                  <Table.Th style={{ width: "180px", textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((item) => {
                  const initial = (item.name || "").charAt(0).toUpperCase() || "?";
                  const isVerified = item.isVerified || false;
                  const isAdmin = item.role === "admin";

                  return (
                    <Table.Tr key={item._id}>
                      {/* User Info Column */}
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar color={isAdmin ? "red" : "blue"} radius="xl">
                            {initial}
                          </Avatar>
                          <Box style={{ minWidth: 0 }}>
                            <Text size="sm" fw={600} truncate>
                              {item.name || "N/A"}
                            </Text>
                            <Text size="xs" color="dimmed">
                              ID: {item._id}
                            </Text>
                          </Box>
                        </Group>
                      </Table.Td>

                      {/* Email Column */}
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {item.email}
                        </Text>
                      </Table.Td>

                      {/* Verification Status Column */}
                      <Table.Td>
                        {isVerified ? (
                          <Badge
                            color="green"
                            variant="light"
                            leftSection={<IconMailCheck size={12} />}
                          >
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            color="yellow"
                            variant="light"
                            leftSection={<IconMailX size={12} />}
                          >
                            Unverified
                          </Badge>
                        )}
                      </Table.Td>

                      {/* Role Column */}
                      <Table.Td>
                        {isAdmin ? (
                          <Badge color="red" variant="filled">
                            Admin
                          </Badge>
                        ) : (
                          <Badge color="blue" variant="outline">
                            Coder
                          </Badge>
                        )}
                      </Table.Td>

                      {/* Actions Column */}
                      <Table.Td style={{ textAlign: "right" }}>
                        {!isAdmin && (
                          <Button
                            size="xs"
                            color="teal"
                            variant="light"
                            leftSection={<IconShield size={14} />}
                            loading={promotingId === item._id}
                            onClick={() => handlePromote(item._id, item.email)}
                          >
                            Elevate to Admin
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Card>
        )}

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              value={page}
              onChange={setPage}
              total={totalPages}
              color="blue"
              radius="md"
              withEdges
            />
          </Group>
        )}
      </Stack>
    </Container>
  );
};

export default UsersPage;
