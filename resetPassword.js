// Quick password reset script — run with: node resetPassword.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const email     = 'rabeccakaleem255@gmail.com'; // change if needed
const newPassword = 'CareerIS@2026';             // your new password

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const hashed = await bcrypt.hash(newPassword, 12);
    const result = await mongoose.connection.db.collection('users').updateOne(
        { email },
        { $set: { password: hashed, resetPasswordToken: undefined, resetPasswordExpire: undefined } }
    );

    if (result.matchedCount === 0) {
        console.log('❌ No user found with that email.');
    } else {
        console.log(`✅ Password reset! You can now log in with:`);
        console.log(`   Email:    ${email}`);
        console.log(`   Password: ${newPassword}`);
    }

    await mongoose.disconnect();
}

run().catch(console.error);
