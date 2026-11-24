require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('✅ Connected\n');
    const users = await mongoose.connection.db.collection('users')
        .find({ role: { $in: ['admin', 'student'] } })
        .toArray();
    users.forEach(u => console.log(u.role, '|', u.email));
    process.exit();
}).catch(console.error);
