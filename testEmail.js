require('dotenv').config();
const nodemailer = require('nodemailer');

async function test() {
    console.log('📧 Testing email with:', process.env.EMAIL_USER);

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified! Email is configured correctly.');

        await transporter.sendMail({
            from: `CareerIS <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: '✅ CareerIS Email Test',
            html: '<h2>It works!</h2><p>Your CareerIS email is set up correctly.</p>'
        });

        console.log('✅ Test email sent to', process.env.EMAIL_USER, '— check your inbox!');
    } catch (err) {
        console.error('❌ Email error:', err.message);
    }
}

test();
