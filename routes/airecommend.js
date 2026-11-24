const express = require('express');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');
const Internship = require('../models/Internship');

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

// ── Simple login check (only logged-in users may use the AI) ──
function requireLogin(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ success: false, message: 'Not logged in' });
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET missing in .env (check the exact name used by your auth code)');
            return res.status(500).json({ success: false, message: 'Server auth is not configured' });
        }
        jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}

const norm = (s) => String(s || '').toLowerCase().trim();

// Local pre-score so we only send the best candidates to Gemini
function localScore(userSkills, job) {
    const jobSkills = (job.skills || []).map(norm);
    const text = norm(`${job.title} ${job.description} ${job.industry || ''}`);
    let score = 0;
    for (const s of userSkills.map(norm)) {
        if (!s) continue;
        if (jobSkills.some((js) => js.includes(s) || s.includes(js))) score += 3;
        else if (text.includes(s)) score += 1;
    }
    return score;
}

// POST /api/internships/ai-recommend
// body: { skills, summary, experience, extra }  (sent by student.html)
router.post('/ai-recommend', requireLogin, async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.json({ success: false, message: 'AI is not configured' });
        }

        const { skills = '', summary = '', experience = '', extra = '' } = req.body;

        const userSkills = (Array.isArray(skills) ? skills : String(skills).split(','))
            .map((s) => String(s).trim())
            .filter(Boolean)
            .slice(0, 30);

        if (!userSkills.length && !String(summary).trim() && !String(experience).trim()) {
            return res.json({ success: true, recommendations: [] });
        }

        // Only approved listings whose deadline has not passed (Pakistan time)
        const todayPK = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
        const cutoff = new Date(`${todayPK}T00:00:00.000Z`);

        const all = await Internship.find({
            status: 'approved',
            $or: [{ deadline: null }, { deadline: { $gte: cutoff } }]
        })
            .select('title company type industry location salary deadline skills description applyLink')
            .lean();

        if (!all.length) return res.json({ success: true, recommendations: [] });

        const shortlist = all
            .map((j) => ({ job: j, score: localScore(userSkills, j) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 12);

        const byId = new Map(shortlist.map((x) => [String(x.job._id), x.job]));

        const candidates = shortlist.map((x) => ({
            id: String(x.job._id),
            title: x.job.title,
            company: x.job.company,
            type: x.job.type,
            requiredSkills: x.job.skills,
            description: String(x.job.description || '').slice(0, 300)
        }));

        const prompt = `
You are a career advisor for female university students in Pakistan.

STUDENT RESUME
Skills: ${userSkills.join(', ') || 'not given'}
Summary: ${String(summary).slice(0, 500) || 'not given'}
Experience: ${String(experience).slice(0, 600) || 'not given'}
Achievements: ${String(extra).slice(0, 300) || 'not given'}

AVAILABLE LISTINGS (recommend ONLY from these ids):
${JSON.stringify(candidates)}

Choose up to 6 listings that genuinely fit this student. Skip listings that do not fit,
even if that means returning fewer than 6.
Return ONLY valid JSON in exactly this shape:
{
  "recommendations": [
    { "id": "<listing id>", "matchScore": <integer 0-100>, "reason": "<max 2 short sentences: why it fits, and mention 1-2 missing skills to learn if any>" }
  ]
}`;

        // Gemini is sometimes briefly overloaded (503 UNAVAILABLE) or rate limited (429).
        // Retry a few times with a short delay before giving up.
        // If the main model is busy, try the fallback models listed in .env
        // (GEMINI_FALLBACK_MODELS=model-a,model-b), 2 attempts each.
        const modelsToTry = [MODEL, ...FALLBACK_MODELS];
        let response;
        let lastError;
        outer: for (const modelName of modelsToTry) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    response = await ai.models.generateContent({
                        model: modelName,
                        contents: prompt,
                        config: { responseMimeType: 'application/json' }
                    });
                    break outer;
                } catch (e) {
                    lastError = e;
                    const temporary = /UNAVAILABLE|503|429|overloaded|high demand/i.test(String(e.message || ''));
                    if (!temporary) break; // not a busy error: move on to the next model
                    console.warn(`Gemini ${modelName} busy (attempt ${attempt}/2)`);
                    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
                }
            }
        }
        if (!response) throw lastError || new Error('No Gemini model responded');

        const raw = String(response.text || '').replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(raw);

        const recommendations = (parsed.recommendations || [])
            .filter((r) => byId.has(String(r.id)))
            .slice(0, 6)
            .map((r) => ({
                internship: byId.get(String(r.id)),
                matchScore: Math.max(0, Math.min(100, Number(r.matchScore) || 0)),
                reason: String(r.reason || '')
            }))
            .sort((a, b) => b.matchScore - a.matchScore);

        res.json({ success: true, recommendations });
    } catch (err) {
        console.error('ai-recommend error:', err.message);
        // success:false makes student.html fall back to its local keyword matching
        res.json({ success: false, message: 'AI recommendation failed' });
    }
});

module.exports = router;