const nodemailer = require('nodemailer');

// ── Create transporter ───────────────────────────────────
const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST  || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ── Shared HTML wrapper ──────────────────────────────────
function wrap(content) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        body { margin:0; padding:0; background:#f0f2f5; font-family:'Segoe UI',Arial,sans-serif; }
        .wrapper { max-width:600px; margin:30px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 30px rgba(0,0,0,.08); }
        .header  { background:linear-gradient(135deg,#6c5ce7 0%,#a29bfe 100%); padding:32px 40px; text-align:center; color:white; }
        .header h1 { margin:0 0 6px; font-size:1.5rem; font-weight:700; }
        .header p  { margin:0; opacity:.85; font-size:.9rem; }
        .body    { padding:36px 40px; color:#444; line-height:1.6; }
        .body h2 { color:#1a1a2e; font-size:1.15rem; font-weight:700; margin-top:0; }
        .highlight { background:#f0eeff; border-left:4px solid #6c5ce7; padding:14px 18px; border-radius:0 8px 8px 0; margin:20px 0; }
        .btn { display:inline-block; background:linear-gradient(135deg,#6c5ce7,#a29bfe); color:white!important; text-decoration:none; padding:12px 28px; border-radius:50px; font-weight:600; font-size:.9rem; margin:16px 0; }
        .status-approved { color:#00b894; font-weight:700; }
        .status-rejected { color:#d63031; font-weight:700; }
        .status-pending  { color:#f39c12; font-weight:700; }
        .footer { background:#f8f9fa; padding:20px 40px; text-align:center; font-size:.75rem; color:#adb5bd; border-top:1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>🎓 CareerIS</h1>
          <p>Jinnah University for Women · Career Information System</p>
        </div>
        ${content}
        <div class="footer">
          This is an automated message from CareerIS &mdash; please do not reply directly.<br>
          &copy; ${new Date().getFullYear()} Jinnah University for Women
        </div>
      </div>
    </body>
    </html>`;
}

// ── Send helper (logs if email not configured) ───────────
async function send({ to, subject, html, attachments }) {
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_gmail@gmail.com') {
        console.log(`📧 [EMAIL NOT CONFIGURED] Would send to ${to}: ${subject}`);
        return;
    }
    try {
        await transporter.sendMail({
            from:    process.env.EMAIL_FROM || `CareerIS <${process.env.EMAIL_USER}>`,
            to, subject, html,
            ...(attachments && attachments.length ? { attachments } : {})
        });
        console.log(`📧 Email sent to ${to}: ${subject}`);
    } catch (err) {
        console.error(`📧 Email error: ${err.message}`);
    }
}

// ── 1. Welcome email (student & alumni registration) ────
async function sendWelcome({ name, email, role }) {
    const roleLabel = role === 'alumni' ? 'Alumni' : 'Student';
    const message   = role === 'alumni'
        ? 'Your alumni account has been submitted for admin review. You will receive another email once approved.'
        : 'Your student account is now active. Start exploring internships and uploading your certificates!';
    await send({
        to: email,
        subject: `Welcome to CareerIS, ${name}! 🎓`,
        html: wrap(`
        <div class="body">
            <h2>Welcome, ${name}! 👋</h2>
            <p>Your <strong>${roleLabel}</strong> account has been created on <strong>CareerIS</strong>.</p>
            <div class="highlight">${message}</div>
            <a href="${process.env.BASE_URL || 'http://localhost:5000'}/login.html" class="btn">Go to CareerIS →</a>
            <p style="font-size:.82rem;color:#adb5bd;">If you didn't create this account, please ignore this email.</p>
        </div>`)
    });
}

// ── 2. Alumni approved by admin ──────────────────────────
async function sendAlumniApproved({ name, email }) {
    await send({
        to: email,
        subject: `✅ Your CareerIS alumni account has been approved!`,
        html: wrap(`
        <div class="body">
            <h2>Great news, ${name}! 🎉</h2>
            <p>Your <strong>CareerIS alumni account</strong> has been reviewed and <span class="status-approved">approved</span> by the admin.</p>
            <div class="highlight">You can now log in to your dashboard, post internship opportunities for students, and connect with the JUW community.</div>
            <a href="${process.env.BASE_URL || 'http://localhost:5000'}/login.html" class="btn">Log In Now →</a>
        </div>`)
    });
}

// ── 3. Certificate verified / rejected ──────────────────
async function sendCertificateStatus({ studentName, studentEmail, certTitle, status, rejectReason, certId }) {
    const isApproved = status === 'approved';
    const verifyUrl  = `${process.env.BASE_URL || 'http://localhost:5000'}/verify?id=${certId}`;
    await send({
        to: studentEmail,
        subject: `Certificate ${isApproved ? '✅ Verified' : '❌ Rejected'}: ${certTitle}`,
        html: wrap(`
        <div class="body">
            <h2>Certificate Update</h2>
            <p>Your certificate <strong>"${certTitle}"</strong> has been reviewed.</p>
            <div class="highlight">
                Status: <span class="${isApproved ? 'status-approved' : 'status-rejected'}">${isApproved ? '✅ Verified & Approved' : '❌ Rejected'}</span>
                ${!isApproved && rejectReason ? `<br><br><strong>Reason:</strong> ${rejectReason}` : ''}
            </div>
            ${isApproved ? `<p>Your certificate is now publicly verifiable via the link below. Share this link or the QR code with employers to prove your credential.</p><a href="${verifyUrl}" class="btn">View Verification Page →</a>` : '<p>You may re-upload a corrected version from your student dashboard.</p>'}
        </div>`)
    });
}

// ── 4. New application received (alumni) ────────────────
async function sendNewApplication({ alumniName, alumniEmail, studentName, studentEmail, internshipTitle, coverLetter, cvAttachmentPath }) {
    const attachments = [];
    if (cvAttachmentPath) attachments.push({ filename: 'CV_' + studentName.replace(/\s+/g,'_') + require('path').extname(cvAttachmentPath), path: cvAttachmentPath });

    await send({
        to: alumniEmail,
        subject: `📥 New application for "${internshipTitle}"`,
        html: wrap(`
        <div class="body">
            <h2>New Application Received</h2>
            <p>Hi ${alumniName},</p>
            <p><strong>${studentName}</strong>${studentEmail ? ` (${studentEmail})` : ''} has applied for your internship posting:</p>
            <div class="highlight"><strong>${internshipTitle}</strong></div>
            ${coverLetter ? `<p><strong>Cover Letter:</strong></p><div class="highlight">${coverLetter.replace(/\n/g,'<br>')}</div>` : ''}
            ${cvAttachmentPath ? `<p>The student's CV is attached to this email.</p>` : '<p>No CV was attached to this application.</p>'}
            <p>Log in to your CareerIS dashboard to review the application and shortlist candidates.</p>
            <a href="${process.env.BASE_URL || 'http://localhost:5000'}/dashboard/alumni.html" class="btn">Review Applications →</a>
        </div>`),
        attachments
    });
}

// ── 5. Application status changed (student) ─────────────
async function sendApplicationStatus({ studentName, studentEmail, internshipTitle, status }) {
    const statusMap = {
        shortlisted: { label: '⭐ Shortlisted',   color: 'status-approved', msg: 'Congratulations! You have been shortlisted. The alumni may contact you for the next steps.' },
        hired:       { label: '🎉 Hired',          color: 'status-approved', msg: 'Amazing news! You have been selected for this internship. Expect a follow-up from the alumni soon.' },
        rejected:    { label: '❌ Not Selected',   color: 'status-rejected', msg: 'Unfortunately you were not selected for this position. Keep applying — more opportunities are available!' },
        reviewing:   { label: '👀 Under Review',   color: 'status-pending',  msg: 'Your application is currently being reviewed by the alumni.' },
    };
    const info = statusMap[status] || { label: status, color: 'status-pending', msg: '' };
    await send({
        to: studentEmail,
        subject: `Application Update: ${info.label} — ${internshipTitle}`,
        html: wrap(`
        <div class="body">
            <h2>Application Status Update</h2>
            <p>Hi ${studentName},</p>
            <p>Your application for <strong>"${internshipTitle}"</strong> has been updated.</p>
            <div class="highlight">Status: <span class="${info.color}">${info.label}</span><br><br>${info.msg}</div>
            <a href="${process.env.BASE_URL || 'http://localhost:5000'}/dashboard/student.html" class="btn">View My Applications →</a>
        </div>`)
    });
}

// ── 6. Internship approved / rejected (alumni) ──────────
async function sendInternshipStatus({ alumniName, alumniEmail, internshipTitle, status }) {
    const isApproved = status === 'approved';
    await send({
        to: alumniEmail,
        subject: `Internship ${isApproved ? '✅ Approved' : '❌ Rejected'}: ${internshipTitle}`,
        html: wrap(`
        <div class="body">
            <h2>Internship Posting Update</h2>
            <p>Hi ${alumniName},</p>
            <p>Your internship posting <strong>"${internshipTitle}"</strong> has been reviewed by the admin.</p>
            <div class="highlight">Status: <span class="${isApproved ? 'status-approved' : 'status-rejected'}">${isApproved ? '✅ Approved — Now visible to students' : '❌ Rejected — Not published'}</span></div>
            ${isApproved ? '<p>Students can now browse and apply for your posting on CareerIS.</p>' : '<p>Please review your posting details and resubmit if needed.</p>'}
            <a href="${process.env.BASE_URL || 'http://localhost:5000'}/dashboard/alumni.html" class="btn">Go to Dashboard →</a>
        </div>`)
    });
}

// ── 7. Password reset email ──────────────────────────────
async function sendPasswordReset({ name, email, resetUrl }) {
    await send({
        to: email,
        subject: `🔐 Reset Your CareerIS Password`,
        html: wrap(`
        <div class="body">
            <h2>Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your <strong>CareerIS</strong> password. Click the button below to set a new password:</p>
            <a href="${resetUrl}" class="btn">Reset My Password →</a>
            <div class="highlight" style="margin-top:20px;">
                <strong>⚠️ This link expires in 15 minutes.</strong><br>
                If you did not request a password reset, you can safely ignore this email — your password will not change.
            </div>
            <p style="font-size:.82rem;color:#adb5bd;margin-top:16px;">If the button doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
        </div>`)
    });
}

module.exports = {
    sendWelcome,
    sendAlumniApproved,
    sendCertificateStatus,
    sendNewApplication,
    sendApplicationStatus,
    sendInternshipStatus,
    sendPasswordReset
};