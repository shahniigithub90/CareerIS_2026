require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const hash = await bcrypt.hash('CareerIS@2026', 10);
    const result = await mongoose.connection.db.collection('users').updateOne(
        { email: 'admin@juw.edu.pk' },
        { $set: { password: hash } }
    );
    console.log('✅ Admin password reset!');
    console.log('   Email:    admin@juw.edu.pk');
    console.log('   Password: CareerIS@2026');
    process.exit();
}).catch(console.error);
