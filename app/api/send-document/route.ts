import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { type, id, number, title, clientName, clientEmail, total, toEmail } = await req.json();

  if (!toEmail) return NextResponse.json({ error: "No recipient email" }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Email not configured" }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const publicUrl = type === "quote" ? `${appUrl}/q/${id}` : `${appUrl}/inv/${id}`;
  const docLabel = type === "quote" ? "Quote" : "Invoice";
  const fromName = process.env.RESEND_FROM_NAME ?? "Trevikon IT";
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@trevikon.com";

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: toEmail,
    subject: `${docLabel} ${number} from ${fromName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; border: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">${fromName}</h2>
            <p style="margin: 0 0 32px; color: #6b7280; font-size: 14px;">${docLabel} ${number}</p>

            <p style="color: #374151; font-size: 15px; margin: 0 0 8px;">Hi ${clientName ?? "there"},</p>
            <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">
              Please find your ${docLabel.toLowerCase()}${title ? ` for <strong>${title}</strong>` : ""} attached below.
            </p>

            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 28px; border: 1px solid #e5e7eb;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6b7280; font-size: 13px;">${docLabel} Number</span>
                <span style="color: #111827; font-weight: 600; font-size: 13px;">${number}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6b7280; font-size: 13px;">Total</span>
                <span style="color: #111827; font-weight: 700; font-size: 16px;">$${Number(total).toFixed(2)}</span>
              </div>
            </div>

            <a href="${publicUrl}" style="display: block; text-align: center; background: #111827; color: white; text-decoration: none; padding: 14px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
              View ${docLabel}
            </a>

            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              If you have questions, reply to this email or contact us at ${fromEmail}.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
