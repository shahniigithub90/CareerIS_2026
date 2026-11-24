const mongoose = require('mongoose');

// A student's confirmation of what happened after they applied for an
// internship/job: did the company accept or reject them? If accepted,
// the student uploads the offer letter. Admin sees every record.
const confirmationSchema = new mongoose.Schema({
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, unique: true },
    internship:  { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fullName:    { type: String, required: true, trim: true },
    field:       { type: String, required: true, trim: true },
    year:        { type: String, required: true, trim: true },
    decision:    { type: String, enum: ['accepted', 'rejected'], required: true },
    offerLetterUrl:  { type: String },
    offerLetterName: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Confirmation', confirmationSchema);
