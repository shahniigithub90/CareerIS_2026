// ── One-time script to create admin accounts ─────────────
// Run with: node createAdmin.js
// Delete this file after running for security

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');

const admins = [
    { name: 'Admin',  email: 'admin@juw.edu.pk', password: 'JUW@Admin2026' }
];

async function createAdmins() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        for (const a of admins) {
            // Delete existing and recreate — model pre-save hook handles hashing
            await User.deleteOne({ email: a.email });
            const admin = new User({
                name:       a.name,
                email:      a.email,
                password:   a.password,
                role:       'admin',
                isApproved: true,
                isActive:   true
            });
            await admin.save();
            console.log(`✅ Admin created: ${a.email}`);
        }

        console.log('\n🎓 Done! You can now login at http://localhost:5000/login.html');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

createAdmins();
