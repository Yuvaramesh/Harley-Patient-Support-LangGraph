import nodemailer from "nodemailer";

interface EmailPayload {
  to: string;
  subject: string;
  htmlContent: string;
  questions: Array<{ q: string; a: string }>;
}

export async function sendCommunicationEmail(
  payload: EmailPayload
): Promise<boolean> {
  // Note: Configure with your email provider (Gmail, SendGrid, etc.)
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const qaHtml = payload.questions
    .map(
      (item) =>
        `<div style="margin: 15px 0; padding: 10px; border-left: 3px solid #4CAF50;">
        <p><strong>Q: ${item.q}</strong></p>
        <p>A: ${item.a}</p>
      </div>`
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your Healthcare Portal Communication</h2>
      <p>Below is a summary of your recent interaction with our healthcare portal:</p>
      ${qaHtml}
      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        This is an automated email from Harley Health Portal. Please do not reply to this email.
        Log in to your portal to view complete details.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: payload.to,
      subject: payload.subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}

export async function sendEmergencyAlert(
  patientEmail: string,
  emergencyDetails: string
): Promise<boolean> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff3cd; border: 2px solid #ff6b6b; padding: 20px;">
      <h2 style="color: #d32f2f;">EMERGENCY ALERT - IMMEDIATE ACTION REQUIRED</h2>
      <p>${emergencyDetails}</p>
      <p style="color: #d32f2f;"><strong>Please contact emergency services or visit the nearest emergency room immediately.</strong></p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: patientEmail,
      subject: "URGENT: Emergency Alert from Harley Health",
      html,
    });
    return true;
  } catch (error) {
    console.error("Emergency email send failed:", error);
    return false;
  }
}
