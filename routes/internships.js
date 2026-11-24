const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Internship  = require('../models/Internship');
const Application = require('../models/Application');
const User        = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');
const { sendNewApplication, sendApplicationStatus, sendInternshipStatus } = require('../utils/emailService');

// ── Multer storage for offer letters ─────────────────────
const offerLetterStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/offerletters');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `offer-${req.user._id}-${unique}${path.extname(file.originalname)}`);
    }
});
const uploadOfferLetter = multer({
    storage: offerLetterStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
        cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
    }
});

// ── GET all approved internships (students browse) ───────
router.get('/', protect, async (req, res) => {
    try {
        const filter = { status: 'approved' };
        if (req.query.search) {
            filter.$or = [
                { title:    { $regex: req.query.search, $options: 'i' } },
                { company:  { $regex: req.query.search, $options: 'i' } },
                { skills:   { $regex: req.query.search, $options: 'i' } },
            ];
        }
        if (req.query.type)     filter.type     = { $regex: req.query.type,     $options: 'i' };
        if (req.query.location) filter.location = { $regex: req.query.location, $options: 'i' };
        const internships = await Internship.find(filter)
            .populate('postedBy', 'name company')
            .sort('-createdAt');
        res.json({ success: true, count: internships.length, internships });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET recommended internships for student ──────────────
// Scores each approved internship based on keyword match with student's department/profile
router.get('/recommended/for-me', protect, async (req, res) => {
    try {
        const student = await User.findById(req.user._id).select('department year skills');
        const internships = await Internship.find({ status: 'approved' })
            .populate('postedBy', 'name company')
            .sort('-createdAt')
            .limit(50);

        // Build a keyword bag from the student profile
        const dept   = (student.department || '').toLowerCase();
        const skills = (student.skills     || '').toLowerCase();
        const rawKeywords = `${dept} ${skills}`
            .split(/[\s,]+/)
            .filter(k => k.length > 2);

        // Dept → industry keyword map
        const deptMap = {
            'computer science': ['software','developer','data','web','it','tech','ai','ml','python','java','react'],
            'cs':               ['software','developer','data','web','it','tech'],
            'bsit':             ['web','developer','it','software','network'],
            'information technology': ['web','it','software','network','database'],
            'se':               ['software','qa','testing','backend','frontend','fullstack'],
            'software engineering': ['software','qa','testing','backend','frontend'],
            'data science':     ['data','analytics','python','machine learning','ai','sql'],
            'business':         ['marketing','management','finance','hr','sales'],
            'accounting':       ['finance','accounting','audit','tax'],
            'bba':              ['marketing','hr','sales','finance','management'],
        };

        const expandedKeywords = [...rawKeywords];
        for (const [key, extras] of Object.entries(deptMap)) {
            if (dept.includes(key)) expandedKeywords.push(...extras);
        }

        // Score each internship
        const scored = internships.map(job => {
            const haystack = `${job.title} ${job.company} ${job.description} ${(job.skills||[]).join(' ')} ${job.industry||''}`.toLowerCase();
            let score = 0;
            for (const kw of expandedKeywords) {
                if (haystack.includes(kw)) score++;
            }
            return { ...job.toObject(), _score: score };
        });

        // Sort by score desc, take top 6, filter score > 0 first
        const top = scored
            .sort((a, b) => b._score - a._score)
            .filter(j => j._score > 0)
            .slice(0, 6);

        // If fewer than 3 matches, pad with newest postings
        const result = top.length >= 3 ? top : internships.slice(0, 6).map(j => j.toObject ? j.toObject() : j);

        res.json({ success: true, internships: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET single internship ────────────────────────────────
router.get('/:id', protect, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id).populate('postedBy', 'name company email');
        if (!internship) return res.status(404).json({ success: false, message: 'Internship not found' });

        const isOwner = internship.postedBy?._id?.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        if (internship.status !== 'approved' && !isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'This internship is not yet approved.' });
        }

        res.json({ success: true, internship });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST create internship (alumni only) ─────────────────
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'alumni' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only alumni can post internships.' });
        }
        // Admin posts go live immediately; alumni posts need admin approval
        const status = req.user.role === 'admin' ? 'approved' : 'pending';
        const internship = await Internship.create({ ...req.body, postedBy: req.user._id, status });
        const msg = req.user.role === 'admin'
            ? 'Internship posted and published successfully.'
            : 'Internship submitted! Admin will review and publish it shortly.';
        res.status(201).json({ success: true, message: msg, internship });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET my postings (alumni) ─────────────────────────────
router.get('/my/postings', protect, async (req, res) => {
    try {
        const internships = await Internship.find({ postedBy: req.user._id }).sort('-createdAt');
        res.json({ success: true, internships });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE internship (alumni owner or admin) ────────────
router.delete('/:id', protect, async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ success: false, message: 'Not found' });
        if (internship.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        await internship.deleteOne();
        res.json({ success: true, message: 'Internship deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST apply for internship (student) ──────────────────
router.post('/:id/apply', protect, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can apply.' });
        }
        const existing = await Application.findOne({ internship: req.params.id, student: req.user._id });
        if (existing) return res.status(400).json({ success: false, message: 'You already applied for this internship.' });

        const application = await Application.create({
            internship:  req.params.id,
            student:     req.user._id,
            coverLetter: req.body.coverLetter || '',
            cvLink:      req.body.cvLink || '',
            timeline: [{ stage: 'Applied', note: 'Application submitted' }]
        });
        const internship = await Internship.findByIdAndUpdate(req.params.id, { $inc: { applications: 1 } }, { new: true }).populate('postedBy', 'name email');

        res.status(201).json({ success: true, message: 'Application submitted successfully!', application });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET my applications (student) ────────────────────────
router.get('/my/applications', protect, async (req, res) => {
    try {
        const applications = await Application.find({ student: req.user._id })
            .populate('internship', 'title company location type salary deadline')
            .sort('-createdAt');
        res.json({ success: true, applications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET applicants for a posting (alumni) ────────────────
router.get('/:id/applicants', protect, async (req, res) => {
    try {
        const applications = await Application.find({ internship: req.params.id })
            .populate('student', 'name email department year studentId')
            .sort('-createdAt');
        res.json({ success: true, applications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH update application status (alumni) ─────────────
router.patch('/applications/:appId/status', protect, async (req, res) => {
    try {
        const { status, note } = req.body;
        const application = await Application.findById(req.params.appId);
        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

        application.status = status;
        application.timeline.push({ stage: status.charAt(0).toUpperCase() + status.slice(1), note: note || '' });
        await application.save();

        // Notify student of status change
        const populated = await Application.findById(application._id)
            .populate('student', 'name email')
            .populate('internship', 'title');
        if (populated?.student) {
            sendApplicationStatus({
                studentName:      populated.student.name,
                studentEmail:     populated.student.email,
                internshipTitle:  populated.internship?.title || 'Internship',
                status
            }).catch(() => {});
        }

        res.json({ success: true, message: 'Application status updated.', application });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST student confirmation form: accept/reject the internship ──
router.post('/applications/:appId/decision', protect, uploadOfferLetter.single('offerLetter'), async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can submit this form.' });
        }
        const application = await Application.findById(req.params.appId);
        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
        if (application.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized for this application.' });
        }

        const { decision, name, field, year, reason } = req.body;
        if (!['accepted', 'rejected'].includes(decision)) {
            return res.status(400).json({ success: false, message: 'Decision must be accepted or rejected.' });
        }
        if (decision === 'accepted' && !req.file) {
            return res.status(400).json({ success: false, message: 'Please upload the offer letter.' });
        }

        application.status         = decision;
        application.decisionMade   = true;
        application.decisionName   = name   || req.user.name;
        application.decisionField  = field  || '';
        application.decisionYear   = year   || '';
        application.decisionReason = decision === 'rejected' ? (reason || '') : '';
        application.decisionDate   = new Date();
        if (req.file) application.offerLetterUrl = `/uploads/offerletters/${req.file.filename}`;
        application.timeline.push({
            stage: decision === 'accepted' ? 'Accepted' : 'Rejected',
            note: decision === 'accepted' ? 'Offer letter uploaded by student.' : (reason || 'Rejected by student.')
        });
        await application.save();

        res.json({ success: true, message: 'Your response has been recorded.', application });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET all student decisions (admin) ─────────────────────
router.get('/admin/decisions', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });
        const decisions = await Application.find({ decisionMade: true })
            .populate('student', 'name email department year')
            .populate('internship', 'title company')
            .sort('-decisionDate');
        res.json({ success: true, decisions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH approve/reject internship (admin only) ─────────
router.patch('/:id/approve', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });
        if (!['approved', 'rejected', 'expired', 'pending'].includes(req.body.status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }
        const internship = await Internship.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        ).populate('postedBy', 'name email role');
        if (!internship) return res.status(404).json({ success: false, message: 'Internship not found' });

        // Notify alumni of internship approval/rejection (not for admin's own posts or unpublishing)
        if (internship.postedBy?.role === 'alumni' && ['approved', 'rejected'].includes(req.body.status)) {
            sendInternshipStatus({
                alumniName:       internship.postedBy.name,
                alumniEmail:      internship.postedBy.email,
                internshipTitle:  internship.title,
                status:           req.body.status
            }).catch(() => {});
        }

        res.json({ success: true, message: `Internship ${req.body.status}.`, internship });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET all pending internships (admin) ──────────────────
router.get('/admin/pending', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });
        const internships = await Internship.find({})
            .populate('postedBy', 'name email company')
            .sort('-createdAt');
        res.json({ success: true, internships });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;