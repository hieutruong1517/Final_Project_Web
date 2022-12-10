var mongoose = require('mongoose')

const otpSchema = mongoose.Schema({
    createdAt: {type: Date, expires: '1m', default: Date.now() }, // otp sẽ tự động mất sau 1p
    email: {type: String, index: true},
    otp: String,
    // expirationTime: Date,
})

const Otp = mongoose.model('Otp', otpSchema)
module.exports = Otp