const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Certificate = require('../models/Certificate');
const { protect } = require('../middleware/authMiddleware');
const { sendCertificateStatus } = require('../utils/emailService');

// ── Multer storage config ────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/certificates');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `cert-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, JPG, JPEG, PNG files are allowed.'), false);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ── POST upload certificate (student) ────────────────────
router.post('/upload', protect, upload.single('certificate'), async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can upload certificates.' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a file.' });
        }

        const { title, issuer, issuerUrl, issueDate, category } = req.body;
        if (!title || !issuer) {
            return res.status(400).json({ success: false, message: 'Title and issuer are required.' });
        }

        const certificate = await Certificate.create({
            student:   req.user._id,
            title,
            issuer,
            issuerUrl: issuerUrl || '',
            issueDate: issueDate || null,
            category:  category || 'Other',
            fileUrl:   `/uploads/certificates/${req.file.filename}`,
            fileName:  req.file.originalname,
            status:    'pending'
        });

        res.status(201).json({ success: true, message: 'Certificate uploaded! Pending admin verification.', certificate });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET my certificates (student) ────────────────────────
router.get('/my', protect, async (req, res) => {
    try {
        const certificates = await Certificate.find({ student: req.user._id }).sort('-createdAt');
        res.json({ success: true, count: certificates.length, certificates });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET all pending certificates (admin) ─────────────────
router.get('/admin/pending', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });
        const certificates = await Certificate.find({ status: 'pending' })
            .populate('student', 'name email studentId department year')
            .sort('-createdAt');
        res.json({ success: true, count: certificates.length, certificates });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET all certificates (admin) ─────────────────────────
router.get('/admin/all', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });
        const { status, search } = req.query;
        const filter = {};
        if (status) filter.status = status;

        let query = Certificate.find(filter)
            .populate('student', 'name email studentId department year')
            .populate('verifiedBy', 'name')
            .sort('-createdAt');

        const certificates = await query;

        // Filter by student name if search provided
        const filtered = search
            ? certificates.filter(c =>
                c.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
                c.title?.toLowerCase().includes(search.toLowerCase())
              )
            : certificates;

        res.json({ success: true, count: filtered.length, certificates: filtered });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH verify/reject certificate (admin) ──────────────
router.patch('/:id/verify', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });

        const { status, rejectReason } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be approved or rejected.' });
        }

        const cert = await Certificate.findById(req.params.id);
        if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found.' });

        cert.status       = status;
        cert.verifiedBy   = req.user._id;
        cert.verifiedAt   = new Date();
        if (status === 'rejected' && rejectReason) cert.rejectReason = rejectReason;

        // Store the public verification URL for QR code generation
        if (status === 'approved') {
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
            cert.qrCode = `${baseUrl}/verify?id=${cert._id}`;
        }

        await cert.save();

        const updated = await Certificate.findById(cert._id).populate('student', 'name email studentId');

        // Email the student
        sendCertificateStatus({
            studentName:  updated.student?.name,
            studentEmail: updated.student?.email,
            certTitle:    updated.title,
            status:       updated.status,
            rejectReason: updated.rejectReason,
            certId:       updated._id
        }).catch(() => {});

        res.json({ success: true, message: `Certificate ${status}.`, certificate: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET single certificate (public verify via QR) ────────
router.get('/verify/:certId', async (req, res) => {
    try {
        const cert = await Certificate.findById(req.params.certId)
            .populate('student', 'name studentId department year')
            .populate('verifiedBy', 'name');
        if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found.' });
        res.json({ success: true, certificate: cert });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE certificate (student owner or admin) ───────────
router.delete('/:id', protect, async (req, res) => {
    try {
        const cert = await Certificate.findById(req.params.id);
        if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found.' });

        if (cert.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        // Delete file from disk
        if (cert.fileUrl) {
            const filePath = path.join(__dirname, '..', cert.fileUrl);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await cert.deleteOne();
        res.json({ success: true, message: 'Certificate deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;