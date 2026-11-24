const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true
    },
    audience: {
        type: String,
        enum: ['all', 'students', 'alumni'],
        default: 'all'
    },
    priority: {
        type: String,
        enum: ['normal', 'important', 'urgent'],
        default: 'normal'
    },
    status: {
        type: String,
        enum: ['published', 'draft'],
        default: 'published'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Announcement', announcementSchema);
