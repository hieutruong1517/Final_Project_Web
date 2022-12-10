const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
    createdAt: { type: Date, expires: '1m', default: Date.now }, //OTP sẽ tự biến mất sau 1 phút
    userEmail: { type: String, index: true },
    OTPCode: {
        type: String,
    },
});


module.exports = mongoose.model('OTP', OTPSchema);
