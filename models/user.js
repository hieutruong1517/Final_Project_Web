const async = require('hbs/lib/async');
var mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    phone: { type: String, index: true },
    email: { type: String, index: true },
    fullname: String,
    birthdate: Date,
    address: String,
    username: { type: String, index: true },
    password: String,
    frontImg: {
        data: Buffer,
        contentType: String,
    },
    backImg: {
        data: Buffer,
        contentType: String,
    },
    LAST_LOGIN: { type: Date, default: null },
});

userSchema.path('email').validate(async (email) => {
    const emailCount = await mongoose.models.User.countDocuments({ email });
    return !emailCount;
}, 'Email already exists');

userSchema.path('phone').validate(async (phone) => {
    const phoneCount = await mongoose.models.User.countDocuments({ phone });
    return !phoneCount;
}, 'Phone already exists');

const User = mongoose.model('User', userSchema);

module.exports = User;
