const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// Ensure uploads directories exist (needed on Render and fresh installs)
const uploadDir = path.join(__dirname, 'uploads', 'certificates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const cvDir = path.join(__dirname, 'uploads', 'cvs');
if (!fs.existsSync(cvDir)) fs.mkdirSync(cvDir, { recursive: true });
const offerDir = path.join(__dirname, 'uploads', 'offer-letters');
if (!fs.existsSync(offerDir)) fs.mkdirSync(offerDir, { recursive: true });

const connectDB = require('./config/db');

const app = express();

// ── Gemini AI client ─────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ── Start Server First, then connect MongoDB ─────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('');
    console.log('🎓 ================================');
    console.log('   CareerIS Server Started!');
    console.log(`   http://localhost:${PORT}`);
    console.log('   Jinnah University for Women');
    console.log('🎓 ================================');
    console.log('');
});

// Connect MongoDB after server is already running
connectDB().then(() => {
    deleteExpiredInternships();
    setInterval(deleteExpiredInternships, 60 * 60 * 1000); // every hour
});

// ── Auto-delete internships whose deadline has passed ────
// A listing stays up through its whole deadline day (Pakistan time) and is
// deleted from the next day. Listings without a deadline are never auto-deleted.
async function deleteExpiredInternships() {
    try {
        const Internship = require('./models/Internship');
        const todayPK = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }); // YYYY-MM-DD
        const cutoff  = new Date(`${todayPK}T00:00:00.000Z`);
        const result  = await Internship.deleteMany({ deadline: { $ne: null, $lt: cutoff } });
        if (result.deletedCount) console.log(`🗑️  Deleted ${result.deletedCount} internship(s) past their deadline`);
    } catch (err) {
        console.error('Expired internship cleanup failed:', err.message);
    }
}

// ── Maintenance Mode ─────────────────────────────────────
// Set to true to show maintenance page, false to go live
const MAINTENANCE = false;
app.use((req, res, next) => {
    if (!MAINTENANCE) return next();
    if (req.path.startsWith('/api')) return res.status(503).json({ message: 'Under maintenance' });
    res.status(503).send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CareerIS — Back Soon</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#050816;color:#fff;font-family:'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;}
  .card{text-align:center;padding:3rem 2.5rem;max-width:480px;}
  .icon{font-size:3.5rem;margin-bottom:1.5rem;}
  h1{font-size:2rem;font-weight:700;margin-bottom:0.75rem;}
  p{color:rgba(255,255,255,0.6);font-size:1rem;line-height:1.7;margin-bottom:2rem;}
  .badge{display:inline-block;padding:8px 22px;border-radius:20px;background:linear-gradient(135deg,#7C3AED,#3B82F6);font-size:0.85rem;font-weight:600;}
</style></head>
<body><div class="card">
  <div class="icon">🛠️</div>
  <h1>We'll be back soon</h1>
  <p>CareerIS is currently undergoing scheduled maintenance. We'll be up and running again shortly — thank you for your patience.</p>
  <span class="badge">Jinnah University for Women</span>
</div></body></html>`);
});

// ── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve Static Frontend ────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Serve Uploaded Files ─────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── AI Career Assistant (Gemini) ─────────────────────────
app.post('/api/ai/chat', async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not set in .env' });
        }

        const { message } = req.body;
        if (!message || !String(message).trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: String(message).slice(0, 2000),
            config: {
                systemInstruction:
                    'You are a career guidance assistant for students of Jinnah University for Women. ' +
                    'Give clear, practical advice about careers, internships, CVs and skills.'
            }
        });

        res.json({ reply: response.text });
    } catch (err) {
        console.error('Gemini error:', err.message);
        res.status(500).json({ error: 'AI request failed' });
    }
});

// ── API Routes ───────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/internships', require('./routes/airecommend'));
app.use('/api/internships',  require('./routes/internships'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/upload',       require('./routes/upload'));
app.use('/api/confirmations', require('./routes/confirmations'));
app.use('/api/ai', require('./routes/ai'));

// ── Public Stats (landing page counters) ─────────────────
app.get('/api/stats', async (req, res) => {
    try {
        const User        = require('./models/User');
        const Internship  = require('./models/Internship');
        const Certificate = require('./models/Certificate');

        const [students, internships, alumni, certificates] = await Promise.all([
            User.countDocuments({ role: 'student', isApproved: true }),
            Internship.countDocuments({ status: 'approved' }),
            User.countDocuments({ role: 'alumni', isApproved: true }),
            Certificate.countDocuments({ status: 'approved' })
        ]);

        res.json({ success: true, students, internships, alumni, certificates });
    } catch (err) {
        res.json({ success: true, students: 0, internships: 0, alumni: 0, certificates: 0 });
    }
});

// ── Serve verify page ────────────────────────────────────
app.get('/verify', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// ── Catch-all: serve frontend for any unmatched route ────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});