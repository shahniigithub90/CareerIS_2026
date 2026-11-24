// ── Application confirmation forms ───────────────────────
// Students tell CareerIS whether they were accepted or rejected for an
// internship they applied to (with an offer letter when accepted).
// Admins can see every submitted record.
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Confirmation = require('../models/Confirmation');
const Application  = require('../models/Application');
const { protect }  = require('../middleware/authMiddleware');

const uploadDir = path.join(__dirname, '../uploads/offer-letters');

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `offer-${req.user._id}-${unique}${path.extname(file.originalname).toLowerCase()}`);
        }
    }),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) cb(null, true);
        else cb(new Error('Offer letter must be a PDF, JPG or PNG file.'));
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// run multer but send errors back as JSON (not an HTML error page)
const offerLetterUpload = (req, res, next) => {
    upload.single('offerLetter')(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'Offer letter must be smaller than 5 MB.' : err.message;
        return res.status(400).json({ success: false, message });
    });
};

const adminOnly = (req, res, next) =>
    req.user.role === 'admin' ? next() : res.status(403).json({ success: false, message: 'Admin access only.' });

// ── GET my confirmations (student) ───────────────────────
router.get('/my', protect, async (req, res) => {
    try {
        const confirmations = await Confirmation.find({ student: req.user._id })
            .populate('internship', 'title company')
            .sort('-createdAt');
        res.json({ success: true, confirmations });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST submit confirmation form (student) ──────────────
// multipart/form-data: applicationId, fullName, field, year, decision, offerLetter(file, if accepted)
router.post('/', protect, offerLetterUpload, async (req, res) => {
    const removeFile = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
    try {
        if (req.user.role !== 'student') {
            removeFile();
            return res.status(403).json({ success: false, message: 'Only students can submit this form.' });
        }
        const { applicationId, fullName, field, year, decision } = req.body;

        if (!applicationId || !fullName?.trim() || !field?.trim() || !year?.trim()) {
            removeFile();
            return res.status(400).json({ success: false, message: 'Please fill in your name, field and year.' });
        }
        if (!['accepted', 'rejected'].includes(decision)) {
            removeFile();
            return res.status(400).json({ success: false, message: 'Please choose Accepted or Rejected.' });
        }
        if (decision === 'accepted' && !req.file) {
            return res.status(400).json({ success: false, message: 'Please upload your offer letter.' });
        }

        const application = await Application.findOne({ _id: applicationId, student: req.user._id });
        if (!application) {
            removeFile();
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        const existing = await Confirmation.findOne({ application: application._id });
        if (existing) {
            removeFile();
            return res.status(400).json({ success: false, message: 'You have already submitted this form.' });
        }

        const confirmation = await Confirmation.create({
            application: application._id,
            internship:  application.internship,
            student:     req.user._id,
            fullName:    fullName.trim(),
            field:       field.trim(),
            year:        year.trim(),
            decision,
            offerLetterUrl:  req.file ? `/uploads/offer-letters/${req.file.filename}` : undefined,
            offerLetterName: req.file ? req.file.originalname : undefined
        });

        // keep the application status in sync with what the student reported
        application.status = decision;
        application.timeline.push({
            stage: decision === 'accepted' ? 'Accepted' : 'Rejected',
            note:  decision === 'accepted' ? 'Student confirmed offer (offer letter uploaded)' : 'Student reported rejection'
        });
        await application.save();

        res.status(201).json({ success: true, message: 'Form submitted to admin.', confirmation });
    } catch (err) {
        removeFile();
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET all student records (admin) ──────────────────────
router.get('/admin', protect, adminOnly, async (req, res) => {
    try {
        const filter = {};
        if (['accepted', 'rejected'].includes(req.query.decision)) filter.decision = req.query.decision;
        const confirmations = await Confirmation.find(filter)
            .populate('student', 'name email studentId department year')
            .populate('internship', 'title company location type')
            .sort('-createdAt');
        res.json({ success: true, count: confirmations.length, confirmations });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
