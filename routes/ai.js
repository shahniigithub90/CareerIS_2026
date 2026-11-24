const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const Internship = require('../models/Internship');

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const norm = (s) => String(s || '').toLowerCase().trim();

// Simple local score: how many of the student's skills appear in the listing
function localScore(userSkills, job) {
    const jobSkills = (job.skills || []).map(norm);
    const text = norm(`${job.title} ${job.description} ${job.industry || ''}`);
    let score = 0;
    for (const s of userSkills.map(norm)) {
        if (jobSkills.some((js) => js.includes(s) || s.includes(js))) score += 3;
        else if (text.includes(s)) score += 1;
    }
    return score;
}

// POST /api/ai/recommend
// body: { skills: ["React","SQL"], education: "BSCS", interests: "web dev", summary: "..." }
router.post('/recommend', async (req, res) => {
    try {
        const { skills = [], education = '', interests = '', summary = '' } = req.body;

        const userSkills = (Array.isArray(skills) ? skills : String(skills).split(','))
            .map((s) => String(s).trim())
            .filter(Boolean)
            .slice(0, 30);

        if (!userSkills.length) {
            return res.status(400).json({ success: false, message: 'Please add at least one skill.' });
        }

        // Only real, approved listings that have not passed their deadline
        const todayPK = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
        const cutoff = new Date(`${todayPK}T00:00:00.000Z`);

        const all = await Internship.find({
            status: 'approved',
            $or: [{ deadline: null }, { deadline: { $gte: cutoff } }]
        })
            .select('title company type industry location salary deadline skills description applyLink')
            .lean();

        if (!all.length) {
            return res.json({ success: true, aiUsed: false, recommendations: [], skillTips: '' });
        }

        // Shortlist the best 12 locally, then let Gemini rank and explain
        const shortlist = all
            .map((j) => ({ job: j, score: localScore(userSkills, j) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 12);

        const byId = new Map(shortlist.map((x) => [String(x.job._id), x]));

        const candidates = shortlist.map((x) => ({
            id: String(x.job._id),
            title: x.job.title,
            company: x.job.company,
            type: x.job.type,
            requiredSkills: x.job.skills,
            description: String(x.job.description || '').slice(0, 300)
        }));

        const prompt = `
You are a career advisor for female university students.

STUDENT PROFILE
Skills: ${userSkills.join(', ')}
Education: ${String(education).slice(0, 200) || 'not given'}
Interests: ${String(interests).slice(0, 200) || 'not given'}
Summary: ${String(summary).slice(0, 500) || 'not given'}

AVAILABLE LISTINGS (you may ONLY recommend from these ids):
${JSON.stringify(candidates)}

Pick up to 5 best matches. Return ONLY valid JSON in exactly this shape:
{
  "recommendations": [
    { "id": "<listing id>", "matchScore": <0-100>, "reason": "<1-2 sentences>", "missingSkills": ["skill"] }
  ],
  "skillTips": "<2-3 sentences on which skills to learn next>"
}`;

        let ai_result = null;
        try {
            const response = await ai.models.generateContent({
                model: MODEL,
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            const raw = String(response.text || '').replace(/```json|```/g, '').trim();
            ai_result = JSON.parse(raw);
        } catch (e) {
            console.error('Gemini recommend error:', e.message);
        }

        if (ai_result && Array.isArray(ai_result.recommendations)) {
            const recommendations = ai_result.recommendations
                .filter((r) => byId.has(String(r.id)))
                .slice(0, 5)
                .map((r) => ({
                    ...byId.get(String(r.id)).job,
                    matchScore: Number(r.matchScore) || 0,
                    reason: r.reason || '',
                    missingSkills: Array.isArray(r.missingSkills) ? r.missingSkills : []
                }));

            return res.json({
                success: true,
                aiUsed: true,
                recommendations,
                skillTips: ai_result.skillTips || ''
            });
        }

        // Fallback if Gemini fails: show the locally matched listings
        const fallback = shortlist
            .filter((x) => x.score > 0)
            .slice(0, 5)
            .map((x) => ({ ...x.job, matchScore: null, reason: '', missingSkills: [] }));

        res.json({ success: true, aiUsed: false, recommendations: fallback, skillTips: '' });
    } catch (err) {
        console.error('Recommend error:', err.message);
        res.status(500).json({ success: false, message: 'Could not generate recommendations.' });
    }
});

module.exports = router;