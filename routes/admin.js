const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const XLSX    = require('xlsx');
const User    = require('../models/User');
const Internship   = require('../models/Internship');
const Application  = require('../models/Application');
const Certificate  = require('../models/Certificate');
const { protect }  = require('../middleware/authMiddleware');
const { sendAlumniApproved } = require('../utils/emailService');
const Announcement = require('../models/Announcement');

// Multer config for Excel uploads (memory storage — no file saved to disk)
const xlsxUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = require('path').extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only .xlsx, .xls, or .csv files are allowed.'), false);
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

// All admin routes require admin role
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access only.' });
    }
    next();
};

// ── GET dashboard stats ───────────────────────────────────
router.get('/stats', protect, adminOnly, async (req, res) => {
    try {
        const [
            totalStudents,
            totalAlumni,
            pendingAlumni,
            totalInternships,
            pendingInternships,
            totalApplications,
            totalCertificates,
            pendingCertificates,
            approvedCertificates
        ] = await Promise.all([
            User.countDocuments({ role: 'student', isActive: true }),
            User.countDocuments({ role: 'alumni', isApproved: true  }),
            User.countDocuments({ role: 'alumni', isApproved: false }),
            Internship.countDocuments({ status: 'approved' }),
            Internship.countDocuments({ status: 'pending' }),
            Application.countDocuments(),
            Certificate.countDocuments(),
            Certificate.countDocuments({ status: 'pending' }),
            Certificate.countDocuments({ status: 'approved' })
        ]);

        // Monthly registrations for chart (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyRegs = await User.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            { $group: {
                _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' }, role: '$role' },
                count: { $sum: 1 }
            }},
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Internship applications by status
        const appsByStatus = await Application.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Monthly applications for last 6 months
        const monthlyApps = await Application.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            { $group: {
                _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
                count: { $sum: 1 }
            }},
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Certificate category breakdown
        const certByCategory = await Certificate.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        // Rejected certificates count
        const rejectedCertificates = await Certificate.countDocuments({ status: 'rejected' });

        // Pending jobs
        const pendingJobs = await Internship.countDocuments({ status: 'pending' });

        res.json({
            success: true,
            stats: {
                totalStudents,
                totalAlumni,
                pendingAlumni,
                totalUsers: totalStudents + totalAlumni,
                totalInternships,
                pendingInternships,
                pendingJobs,
                totalApplications,
                totalCertificates,
                pendingCertificates,
                approvedCertificates,
                rejectedCertificates,
                monthlyRegs,
                monthlyApps,
                appsByStatus,
                certByCategory
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET all users ─────────────────────────────────────────
router.get('/users', protect, adminOnly, async (req, res) => {
    try {
        const { role, search, page = 1, limit = 500, isApproved } = req.query;
        const filter = {};
        if (role) filter.role = role;
        if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
        if (search) {
            filter.$or = [
                { name:  { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { studentId: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select('-password')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ success: true, total, page: Number(page), users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET single user ───────────────────────────────────────
router.get('/users/:id', protect, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH approve alumni account ─────────────────────────
router.patch('/users/:id/approve', protect, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        if (user.role !== 'alumni') return res.status(400).json({ success: false, message: 'Only alumni accounts require approval.' });

        user.isApproved = true;
        user.isActive   = true;
        await user.save();

        // Notify alumni via email
        sendAlumniApproved({ name: user.name, email: user.email }).catch(() => {});

        res.json({ success: true, message: `Alumni account for ${user.name} has been approved.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH toggle user active status ──────────────────────
router.patch('/users/:id/toggle', protect, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot deactivate admin.' });

        user.isActive = !user.isActive;
        await user.save();
        res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, isActive: user.isActive });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE user (admin only) ──────────────────────────────
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin.' });

        await user.deleteOne();
        res.json({ success: true, message: 'User deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET all internships (admin view with filters) ─────────
router.get('/internships', protect, adminOnly, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};
        const internships = await Internship.find(filter)
            .populate('postedBy', 'name email company role')
            .sort('-createdAt');
        res.json({ success: true, count: internships.length, internships });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET recent activity feed ──────────────────────────────
router.get('/activity', protect, adminOnly, async (req, res) => {
    try {
        const [recentUsers, recentCerts, recentInternships, recentApps] = await Promise.all([
            User.find().select('name email role createdAt').sort('-createdAt').limit(5),
            Certificate.find().populate('student', 'name').select('title status createdAt').sort('-createdAt').limit(5),
            Internship.find().populate('postedBy', 'name company').select('title company status createdAt').sort('-createdAt').limit(5),
            Application.find().populate('student', 'name').populate('internship', 'title').select('status createdAt').sort('-createdAt').limit(5)
        ]);

        res.json({ success: true, activity: { recentUsers, recentCerts, recentInternships, recentApps } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST bulk import students via Excel / CSV ─────────────
// Accepts .xlsx/.xls/.csv file with columns: name, email, studentId, department, year, password
router.post('/bulk-import', protect, adminOnly, xlsxUpload.single('file'), async (req, res) => {
    try {
        let students = [];

        if (req.file) {
            // Parse Excel / CSV from uploaded file buffer
            const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet     = workbook.Sheets[sheetName];
            students = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        } else if (req.body.students) {
            // Fallback: JSON body (backward compat)
            students = typeof req.body.students === 'string'
                ? JSON.parse(req.body.students)
                : req.body.students;
        }

        if (!Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ success: false, message: 'No student data found. Upload an Excel file with columns: name, email, studentId, department, year.' });
        }

        const results = { created: 0, skipped: 0, errors: [], createdList: [] };

        for (const s of students) {
            const email = (s.email || s.Email || '').toString().trim().toLowerCase();
            const name  = (s.name  || s.Name  || '').toString().trim();
            if (!email || !name) { results.errors.push({ row: name || email, error: 'Missing name or email' }); continue; }

            try {
                const exists = await User.findOne({ email });
                if (exists) { results.skipped++; continue; }

                const created = await User.create({
                    name,
                    email,
                    password:   (s.password   || s.Password   || 'careeris123').toString().trim(),
                    role:       'student',
                    studentId:  (s.studentId  || s.StudentID  || s.student_id || '').toString().trim(),
                    department: (s.department || s.Department || '').toString().trim(),
                    year:       (s.year       || s.Year       || '').toString().trim(),
                    isApproved: true,
                    isActive:   true
                });
                results.created++;
                results.createdList.push({ name: created.name, email: created.email });
            } catch (e) {
                results.errors.push({ row: email, error: e.message });
            }
        }

        res.json({
            success: true,
            message: `Import complete. Created: ${results.created}, Skipped (existing): ${results.skipped}, Errors: ${results.errors.length}`,
            results
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET alumni directory (all roles can view) ─────────────
router.get('/alumni-directory', protect, async (req, res) => {
    try {
        const { search, department } = req.query;
        const { year } = req.query;
        const filter = { role: 'alumni', isApproved: true };
        if (year) filter.graduationYear = year;
        if (search) {
            filter.$or = [
                { name:        { $regex: search, $options: 'i' } },
                { company:     { $regex: search, $options: 'i' } },
                { designation: { $regex: search, $options: 'i' } }
            ];
        }

        const alumni = await User.find(filter)
            .select('name email company designation graduationYear department linkedIn profilePicture createdAt')
            .sort('-graduationYear');

        res.json({ success: true, count: alumni.length, alumni });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/admin/announcements — create announcement ───
router.post('/announcements', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });
        const { title, message, audience, priority, status } = req.body;
        if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required.' });

        const audienceMap = {
            'Everyone (Students + Alumni)': 'all',
            'Students Only': 'students',
            'Alumni Only': 'alumni',
            'all': 'all', 'students': 'students', 'alumni': 'alumni'
        };
        const priorityMap = {
            'Normal': 'normal', 'Important': 'important', 'Urgent': 'urgent',
            'normal': 'normal', 'important': 'important', 'urgent': 'urgent'
        };

        const ann = await Announcement.create({
            title,
            message,
            audience: audienceMap[audience] || 'all',
            priority: priorityMap[priority] || 'normal',
            status:   status === 'draft' ? 'draft' : 'published',
            createdBy: req.user._id
        });
        res.status(201).json({ success: true, announcement: ann });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/admin/announcements — fetch all (admin) ─────
router.get('/announcements', protect, async (req, res) => {
    try {
        const filter = {};
        // Non-admins only see published announcements for their role
        if (req.user.role !== 'admin') {
            filter.status = 'published';
            filter.audience = { $in: ['all', req.user.role === 'student' ? 'students' : 'alumni'] };
        }
        const anns = await Announcement.find(filter).sort('-createdAt').limit(50);
        res.json({ success: true, announcements: anns });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/admin/announcements/:id ───────────────────
router.delete('/announcements/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' });
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;