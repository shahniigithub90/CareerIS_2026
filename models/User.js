const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // ── Basic Info ──────────────────────────────────────
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    role: {
        type: String,
        enum: ['student', 'alumni', 'admin'],
        default: 'student'
    },

    // ── Student Fields ───────────────────────────────────
    studentId: { type: String, trim: true },
    department: { type: String, trim: true },
    year: { type: String },                     // e.g. "3rd Year"
    skills: [{ type: String }],

    // ── Alumni Fields ────────────────────────────────────
    graduationYear: { type: String },
    company: { type: String, trim: true },
    designation: { type: String, trim: true },
    linkedIn: { type: String, trim: true },

    // ── Account Status ───────────────────────────────────
    isApproved: {
        type: Boolean,
        default: false         // set explicitly on register: true for student/admin, false for alumni
    },
    isActive: {
        type: Boolean,
        default: true
    },

    profilePicture: { type: String, default: '' },

    // ── Password Reset ───────────────────────────────────
    resetPasswordToken:   { type: String },
    resetPasswordExpire:  { type: Date },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ── Hash password before save ────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// ── Compare password ─────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
