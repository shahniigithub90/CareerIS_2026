const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:       { type: String, required: true },
    issuer:      { type: String, required: true },
    issuerUrl:   { type: String, trim: true },
    issueDate:   { type: Date },
    category:    { type: String, enum: ['Programming', 'Data Science', 'Design', 'Networking', 'Cloud', 'Cybersecurity', 'AI/ML', 'Business', 'Development', 'Other'], default: 'Other' },
    fileUrl:     { type: String },
    fileName:    { type: String },
    status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    qrCode:      { type: String },
    verifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:  { type: Date },
    rejectReason:{ type: String },
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);