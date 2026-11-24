const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const { sendWelcome, sendPasswordReset } = require('../utils/emailService');

// ── Helper: Generate JWT ─────────────────────────────────
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });
};

// ── @route   POST /api/auth/register ─────────────────────
// ── @desc    Register new user (student / alumni / admin)
// ── @access  Public
router.post('/register', async (req, res) => {
    try {
        const {
            name, email, password, role,
            // student fields
            studentId, department, year, skills,
            // alumni fields
            graduationYear, company, designation, linkedIn
        } = req.body;

        // ── Name validation ──────────────────────────────────
        if (!name || name.trim().length < 3) {
            return res.status(400).json({ success: false, message: 'Please enter your full name (at least 3 characters).' });
        }
        if (!/^[A-Za-z\s]+$/.test(name.trim())) {
            return res.status(400).json({ success: false, message: 'Name should only contain letters — no numbers or symbols.' });
        }

        // ── Admin secret key check ──────────────────────────
        if (role === 'admin') {
            const { adminSecret } = req.body;
            const correctSecret = process.env.ADMIN_SECRET;
            if (!adminSecret || adminSecret !== correctSecret) {
                return res.status(403).json({
                    success: false,
                    message: 'That admin secret key is incorrect. Only authorized university staff can create admin accounts.'
                });
            }
        }

        // ── Enrollment number format validation ──────────────
        // Accepted format: 2023/COMP/BSCS/30310
        if ((role === 'student' || !role) && req.body.studentId) {
            const enrollPattern = /^\d{4}\/[A-Za-z]{2,8}\/[A-Za-z]{2,8}\/\d{3,6}$/i;
            if (!enrollPattern.test(req.body.studentId.trim())) {
                return res.status(400).json({
                    success: false,
                    message: "That enrollment number doesn't look right. It should follow this format: 2021/IT/BSIT/12345 — starting with your admission year, then faculty, program, and your roll number."
                });
            }
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists. Try logging in instead, or use a different email.'
            });
        }

        // Build user object
        const userData = {
            name,
            email,
            password,
            role: role || 'student'
        };

        // Attach role-specific fields
        if (role === 'student' || !role) {
            if (studentId) userData.studentId = studentId;
            if (department) userData.department = department;
            if (year) userData.year = year;
            if (skills) userData.skills = skills;
            userData.isApproved = true; // students are auto-approved
        }

        if (role === 'alumni') {
            if (graduationYear) userData.graduationYear = graduationYear;
            if (company) userData.company = company;
            if (designation) userData.designation = designation;
            if (linkedIn) userData.linkedIn = linkedIn;
            userData.isApproved = true; // auto-approved so alumni can log in immediately
            userData.isActive   = true;
        }

        if (role === 'admin') {
            userData.isApproved = true;
        }

        const user = await User.create(userData);

        // Send welcome email (fire-and-forget)
        sendWelcome({ name: user.name, email: user.email, role: user.role }).catch(() => {});

        // Alumni must wait for admin approval — do NOT issue a token yet
        // Alumni can now log in immediately after registration

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to CareerIS.',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isApproved: user.isApproved
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── @route   POST /api/auth/login ────────────────────────
// ── @desc    Login user & return token
// ── @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password.' });
        }

        // Find user (include password for comparison)
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Check if active
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact admin.' });
        }

        // Check alumni approval
        if (user.role === 'alumni' && !user.isApproved) {
            return res.status(403).json({ success: false, message: 'Your alumni account is pending admin approval. Please wait for confirmation.' });
        }

        const token = generateToken(user._id);

        // Redirect path based on role
        const redirectMap = {
            student: '/dashboard/student.html',
            alumni: '/dashboard/alumni.html',
            admin: '/dashboard/admin.html'
        };

        res.json({
            success: true,
            message: `Welcome back, ${user.name}!`,
            token,
            redirect: redirectMap[user.role],
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isApproved: user.isApproved,
                department: user.department,
                company: user.company
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── @route   GET /api/auth/me ────────────────────────────
// ── @desc    Get currently logged in user
// ── @access  Private
router.get('/me', protect, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// ── @route   GET /api/auth/users ─────────────────────────
// ── @desc    Get all users (admin only, for testing)
// ── @access  Private
router.get('/users', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access only.' });
        }
        const users = await User.find().select('-password').sort('-createdAt');
        res.json({ success: true, count: users.length, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── @route   PUT /api/auth/profile ───────────────────────
// ── @desc    Update own profile
// ── @access  Private
router.put('/profile', protect, async (req, res) => {
    try {
        const allowedFields = ['name', 'studentId', 'department', 'year', 'skills',
                               'graduationYear', 'company', 'designation', 'linkedIn'];
        const updates = {};
        allowedFields.forEach(f => { if(req.body[f] !== undefined) updates[f] = req.body[f]; });

        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
        res.json({ success: true, message: 'Profile updated.', user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── @route   POST /api/auth/forgot-password ──────────────
// ── @desc    Send reset link to email
// ── @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Please provide your email address.' });

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        // Always respond the same way to prevent email enumeration
        if (!user) {
            return res.json({ success: true, message: 'If that email exists in our system, a reset link has been sent.' });
        }

        // Generate token
        const rawToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken  = crypto.createHash('sha256').update(rawToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password.html?token=${rawToken}`;

        const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_gmail@gmail.com';

        if (emailConfigured) {
            // Real email — send via Gmail SMTP
            await sendPasswordReset({ name: user.name, email: user.email, resetUrl });
            res.json({ success: true, message: 'Password reset link sent to your email. Check your inbox (and spam folder).' });
        } else {
            // No email configured — return the link directly so it works in demo
            console.log(`🔐 Password reset link for ${user.email}: ${resetUrl}`);
            res.json({
                success: true,
                resetUrl,
                message: `Email service not configured. Use the link below to reset your password.`
            });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Could not send reset email. Try again later.' });
    }
});

// ── @route   POST /api/auth/reset-password ───────────────
// ── @desc    Reset password using token from email
// ── @access  Public
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ success: false, message: 'Token and new password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }

        // Hash the incoming token to match what we stored
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken:  hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Please request a new one.' });
        }

        // Set new password (pre-save hook will hash it)
        user.password            = password;
        user.resetPasswordToken  = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.json({ success: true, message: 'Password reset successful! You can now log in with your new password.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── @route   PUT /api/auth/change-password ───────────────
// ── @desc    Change password for logged-in user
// ── @access  Private
router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide current and new password.' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
        }

        const user = await User.findById(req.user._id).select('+password');
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
        }

        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
