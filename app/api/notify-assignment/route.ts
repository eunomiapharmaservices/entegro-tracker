import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    // Not configured — fail quietly so task creation/updates never break
    // just because email isn't set up yet.
    console.warn("RESEND_API_KEY or RESEND_FROM_EMAIL not set; skipping notification email.");
    return NextResponse.json({ skipped: true });
  }

  try {
    const body = await req.json();
    const { to, title, projectName, eid, siteName, dueDate, priority, taskType, assignedByName } =
      body;

    if (!to || !title) {
      return NextResponse.json({ error: "Missing 'to' or 'title'" }, { status: 400 });
    }

    const rows: string[] = [];
    if (taskType) rows.push(`<tr><td style="color:#8a8578;padding:4px 12px 4px 0;">Task type</td><td>${escapeHtml(taskType)}</td></tr>`);
    if (projectName) rows.push(`<tr><td style="color:#8a8578;padding:4px 12px 4px 0;">Project</td><td>${escapeHtml(projectName)}</td></tr>`);
    if (siteName || eid) rows.push(`<tr><td style="color:#8a8578;padding:4px 12px 4px 0;">Site</td><td>${escapeHtml([siteName, eid ? `#${eid}` : null].filter(Boolean).join(" "))}</td></tr>`);
    if (dueDate) rows.push(`<tr><td style="color:#8a8578;padding:4px 12px 4px 0;">Due date</td><td>${escapeHtml(dueDate)}</td></tr>`);
    if (priority) rows.push(`<tr><td style="color:#8a8578;padding:4px 12px 4px 0;">Priority</td><td>${escapeHtml(priority)}</td></tr>`);

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1F5C4A;font-size:18px;">You've been assigned a task</h2>
        <p style="font-size:16px;font-weight:600;margin:12px 0 8px;">${escapeHtml(title)}</p>
        <table style="font-size:14px;border-collapse:collapse;">${rows.join("")}</table>
        ${assignedByName ? `<p style="font-size:12px;color:#8a8578;margin-top:16px;">Assigned by ${escapeHtml(assignedByName)}</p>` : ""}
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `Task assigned: ${title}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("notify-assignment error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
