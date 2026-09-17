const nodemailer = require('nodemailer');

let transporter = null;

/** Lazily creates a single reusable SMTP transporter from env vars. */
function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

const fmt = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const wrapper = (eyebrow, bodyHtml) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;">
      <div style="background:#1c2530;padding:18px 24px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">${process.env.COMPANY_NAME || 'Alok Industries Ltd.'}</h2>
        <p style="color:#f2b134;margin:4px 0 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">${eyebrow}</p>
      </div>
      <div style="padding:24px;border:1px solid #dbe1e7;border-top:none;">
        ${bodyHtml}
        <p style="margin-top:18px;font-size:13px;color:#62707f;">Thanks and Regards<br/>${process.env.COMPANY_NAME || 'Alok Industries Ltd.'}</p>
        <p style="font-size:11px;color:#93a1b0;">Note: This email has been sent from an automated system, please do not reply.</p>
      </div>
    </div>`;

const detailsTable = (rows) => `
  <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:14px;">
    ${rows.map(([label, value]) => `<tr><td style="padding:8px;background:#f5f7f9;font-weight:bold;">${label}</td><td style="padding:8px;">${value}</td></tr>`).join('')}
  </table>`;

const visitorRows = (visitor) => [
  ['Inward Number', visitor.inwardNumber],
  ['Appointment Date & Time', fmt(visitor.appointmentDate)],
  ['Visitor Name', visitor.visitorName],
  ['Representing', visitor.visitorCompany || '—'],
  ['Mobile Number', visitor.mobile],
  ['Email', visitor.email],
  ['Purpose', visitor.purpose],
  ['Person to Meet', visitor.personToMeet || '—'],
  ['Department', visitor.department?.departmentName || '—'],
];

/** Never throws — a slow/misconfigured mail server should not block the
 *  action that triggered the email; failures are logged instead. */
async function safeSend(mailOptions, context) {
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || '"VisitorForYou" <noreply.vms@alokind.com>',
      ...mailOptions,
    });
  } catch (err) {
    console.error(`⚠️  Failed to send ${context}:`, err.message);
  }
}

/**
 * Step 2: notifies the department's HOD (and any active Delegates standing
 * in for them) that a new visitor request needs approval. This is a
 * notification only — approval itself happens inside the VMS app under
 * Transaction > HOD Approval.
 */
async function sendHodApprovalRequestEmail(visitor, toEmails) {
  if (!toEmails || !toEmails.length) {
    console.warn(`⚠️  No HOD/Delegate email on file for department, skipping approval-request email for ${visitor.inwardNumber}`);
    return;
  }
  const html = wrapper(
    'Visitor Request — Awaiting Your Approval',
    `<p>A new visitor request has been raised for your department and needs your review.</p>
     ${detailsTable(visitorRows(visitor))}
     <p style="margin-top:14px;">Please sign in to the VMS and open <b>Transaction &gt; HOD Approval</b> to approve or reject this request.</p>`
  );
  await safeSend(
    { to: toEmails, subject: `HOD Approval Needed: ${visitor.visitorName} : ${visitor.inwardNumber}`, html },
    `HOD approval-request email for ${visitor.inwardNumber}`
  );
}

/**
 * Step 4 (approved path): sends the visitor their appointment confirmation
 * + inward number, now that HOD approval has been granted.
 */
async function sendAppointmentEmail(visitor) {
  const html = wrapper(
    'Visitor Appointment Confirmation',
    `<p>Dear ${visitor.visitorName},</p>
     <p>Your visitor appointment has been approved. Please find the details below and carry a valid ID proof to the gate.</p>
     ${detailsTable(visitorRows(visitor))}`
  );
  await safeSend(
    { to: visitor.email, subject: `Visitor Appointment Details : ${visitor.visitorName} : ${visitor.visitorCompany || 'GUEST'}`, html },
    `appointment email to ${visitor.email}`
  );
}

/**
 * Step 4 (rejected path): sends the person who *raised* the request
 * (Request for Visitor) the rejection notice and the HOD's remark — not
 * the visitor, who was never told a request existed for them.
 */
async function sendRejectionEmail(visitor, requesterEmail) {
  if (!requesterEmail) {
    console.warn(`⚠️  No requester email on file, skipping rejection email for ${visitor.inwardNumber}`);
    return;
  }
  const html = wrapper(
    'Visitor Request Rejected',
    `<p>Your visitor request has been rejected by the HOD.</p>
     ${detailsTable([...visitorRows(visitor), ['Remark', visitor.approvalRemark || '—']])}`
  );
  await safeSend(
    { to: requesterEmail, subject: `Visitor Request Rejected : ${visitor.visitorName} : ${visitor.inwardNumber}`, html },
    `rejection email to ${requesterEmail}`
  );
}

module.exports = { sendHodApprovalRequestEmail, sendAppointmentEmail, sendRejectionEmail };
