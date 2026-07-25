import nodemailer from "nodemailer";

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[Email Service] SMTP configuration is not fully set. Falling back to mock.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(port, 10) || 587,
    secure: port === "465", // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Send email verification link to user via Nodemailer SMTP
 *
 * @param {Object} options
 * @param {string} options.to Email recipient
 * @param {string} options.name Recipient name
 * @param {string} options.token Unhashed raw verification token
 */
export const sendVerificationEmail = async ({ to, name, token }) => {
  const transporter = getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
  const fromEmail = process.env.EMAIL_FROM || '"GreenCode" <greenoncicle@gmail.com>';

  console.log(`[Email Service] Preparing verification email for ${to} (${verifyUrl})`);

  if (!transporter) {
    console.log(`[Email Service Mock] Verification URL for ${to}: ${verifyUrl}`);
    return { success: true, mocked: true, verifyUrl };
  }

  try {
    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject: "Verify your email - GreenCode",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #2b6cb0; margin-bottom: 16px;">Welcome to GreenCode, ${name}!</h2>
          <p style="color: #4a5568; line-height: 1.5; font-size: 16px;">
            Thank you for registering. Please click the button below to verify your email address and activate your account.
          </p>
          <div style="margin: 32px 0; text-align: center;">
            <a href="${verifyUrl}" style="background-color: #3182ce; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #718096; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #3182ce; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            This link will expire in 24 hours. If you did not create an account on GreenCode, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log(`[Email Service] Nodemailer email sent successfully to ${to}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Service Error] Failed to send verification email to ${to}:`, err);
    return { success: false, error: err.message };
  }
};
