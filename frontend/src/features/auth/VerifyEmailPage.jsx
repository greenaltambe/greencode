import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  Stack,
  Loader,
  Group,
  Alert,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconX, IconMailCheck, IconLogout } from "@tabler/icons-react";
import { useAuthStore } from "../../stores/authStore";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const { verifyEmail, resendVerification, user, logout } = useAuthStore();
  const [status, setStatus] = useState("verifying"); // verifying | success | error | pending
  const [errorMessage, setErrorMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Sync state with user email once loaded
  useEffect(() => {
    if (user?.email && !resendEmail) {
      setResendEmail(user.email);
    }
  }, [user, resendEmail]);

  // Effect 1: Handle token verification
  useEffect(() => {
    if (!token) return;

    let isSubscribed = true;
    verifyEmail(token).then((res) => {
      if (!isSubscribed) return;
      if (res.success) {
        setStatus("success");
      } else {
        // Fallback for React Strict Mode double-calling: if user was successfully verified in parallel, show success
        if (useAuthStore.getState().user?.isVerified) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(res.message || "Failed to verify email. Link may be invalid or expired.");
        }
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [token, verifyEmail]);

  // Effect 2: Handle routing/pending state when no token is present
  useEffect(() => {
    if (token) return;

    if (!user) {
      navigate("/login");
      return;
    }
    if (user.isVerified) {
      navigate("/problems");
      return;
    }
    setStatus("pending");
  }, [token, user, navigate]);

  const handleResend = async () => {
    if (!resendEmail) {
      notifications.show({
        title: "Email Required",
        message: "Please enter your email address.",
        color: "red",
      });
      return;
    }

    setIsResending(true);
    const res = await resendVerification(resendEmail);
    setIsResending(false);

    if (res.success) {
      notifications.show({
        title: "Email Sent",
        message: "A new verification email has been sent. Please check your inbox.",
        color: "green",
      });
    } else {
      notifications.show({
        title: "Failed to Send",
        message: res.message || "Could not resend verification email.",
        color: "red",
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Container size="xs" py={80}>
      <Card p="xl" radius="md" withBorder shadow="md">
        {status === "verifying" && (
          <Stack align="center" gap="md" py="xl">
            <Loader size="lg" color="blue" />
            <Title order={3}>Verifying your email...</Title>
            <Text c="dimmed" size="sm" ta="center">
              Please wait while we confirm your email verification link.
            </Text>
          </Stack>
        )}

        {status === "success" && (
          <Stack align="center" gap="md" py="lg">
            <IconCheck size={56} style={{ color: "var(--mantine-color-teal-6)" }} />
            <Title order={2} ta="center">
              Email Verified!
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Your email address has been successfully verified. You now have full access to all features.
            </Text>
            <Button
              color="blue"
              size="md"
              fullWidth
              mt="md"
              onClick={() => navigate(user ? "/problems" : "/login")}
            >
              {user ? "Continue to Problems" : "Proceed to Login"}
            </Button>
          </Stack>
        )}

        {status === "pending" && (
          <Stack gap="md">
            <Group justify="center">
              <IconMailCheck size={56} style={{ color: "var(--mantine-color-orange-6)" }} />
            </Group>
            <Title order={3} ta="center">
              Verification Required
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              Please verify your email address to access GreenCode. We sent a verification email to <b>{user?.email}</b>.
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              If you didn't receive it, verify your email address below and click the button to resend:
            </Text>
            <TextInput
              label="Email Address"
              placeholder="you@example.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.currentTarget.value)}
            />
            <Button
              color="blue"
              leftSection={<IconMailCheck size={16} />}
              loading={isResending}
              onClick={handleResend}
              fullWidth
            >
              Resend Verification Email
            </Button>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconLogout size={16} />}
              fullWidth
              onClick={handleLogout}
            >
              Log Out / Use Different Account
            </Button>
          </Stack>
        )}

        {status === "error" && (
          <Stack gap="md">
            <Group justify="center">
              <IconX size={56} style={{ color: "var(--mantine-color-red-6)" }} />
            </Group>
            <Title order={3} ta="center">
              Verification Failed
            </Title>
            <Alert color="red" title="Error">
              {errorMessage}
            </Alert>
            <Text size="sm" c="dimmed" ta="center">
              Need a new verification link? Enter your email address below to resend:
            </Text>
            <TextInput
              label="Email Address"
              placeholder="you@example.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.currentTarget.value)}
            />
            <Button
              color="blue"
              leftSection={<IconMailCheck size={16} />}
              loading={isResending}
              onClick={handleResend}
              fullWidth
            >
              Resend Verification Email
            </Button>
            <Button variant="subtle" color="gray" fullWidth onClick={handleLogout}>
              Back to Login
            </Button>
          </Stack>
        )}
      </Card>
    </Container>
  );
};

export default VerifyEmailPage;
