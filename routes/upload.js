const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { protect } = require('../middleware/authMiddleware');

// ── Multer config for CV uploads ──────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/cvs/'),
    filename:    (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `${req.user._id}_${Date.now()}_${safe}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only PDF, DOC, and DOCX files are allowed.'));
    }
});

// POST /api/upload/cv  — student uploads their CV
router.post('/cv', protect, upload.single('cv'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const fileUrl = `/uploads/cvs/${req.file.filename}`;
    res.json({ success: true, url: fileUrl, filename: req.file.originalname });
});

module.exports = router;
