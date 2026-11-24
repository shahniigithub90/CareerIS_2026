const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:     { type: String, enum: ['pending', 'reviewing', 'shortlisted', 'accepted', 'rejected', 'hired', 'withdrawn'], default: 'pending' },
    coverLetter:{ type: String },
    cvLink:     { type: String },
    // ── Student self-reported decision (confirmation form) ──
    decisionMade:     { type: Boolean, default: false },
    decisionName:     { type: String },
    decisionField:    { type: String },
    decisionYear:     { type: String },
    decisionReason:   { type: String },
    offerLetterUrl:   { type: String },
    decisionDate:     { type: Date },
    timeline: [{
        stage:  { type: String },
        date:   { type: Date, default: Date.now },
        note:   { type: String }
    }]
}, { timestamps: true });

// Prevent duplicate applications
applicationSchema.index({ internship: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);