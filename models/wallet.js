const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userEmail: {
        required: true,
        type: String,
        unique: true,
        index: true,
    },
    userPhone: {
        required: true,
        type: String,
        unique: true,
        index: true
    },
    ballance: {
        required: true,
        type: Number,
    },
    lastTimeWithdraw: {
        type: Date,
    },
    withdrawalsToday: {
        type: Number,
    },
});
walletSchema.path('userEmail').validate(async (userEmail) => {
    const emailCount = await mongoose.models.wallet.countDocuments({ userEmail });
    console.log(emailCount + 'line 29');
    return !emailCount;
}, 'Đã có ví tồn tại với email này!');

walletSchema.path('userPhone').validate(async (userPhone) => {
    const phoneCount = await mongoose.models.wallet.countDocuments({ userPhone });
    return !phoneCount;
}, 'Đã có ví tồn tại với số điện thoại này này!');

module.exports = mongoose.model('wallet', walletSchema);
