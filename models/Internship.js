const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema({
    title:       { type: String, required: true },
    company:     { type: String, required: true },
    type:        { type: String, enum: ['Full-time', 'Part-time', 'Internship (Paid)', 'Internship (Unpaid)', 'Remote'], default: 'Internship (Paid)' },
    industry:    { type: String },
    location:    { type: String, default: 'Karachi' },
    salary:      { type: String },
    deadline:    { type: Date },
    openings:    { type: Number, default: 1 },
    description: { type: String, required: true },
    skills:      [{ type: String }],
    applyLink:   { type: String },
    juwOnly:     { type: Boolean, default: true },
    postedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:      { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
    applications:{ type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Internship', internshipSchema);