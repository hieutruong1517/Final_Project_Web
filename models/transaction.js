const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userEmail: {
        required: true,
        type: String,
    },
    transDate: {
        required: true,
        type: Date,
    },
    transType: {
        type: String,
        required: true,
    },
    transStatus: {
        required: true,
        type: String,
    },
    transMoney: {
        type: Number,
        required: true,
    },
    transNote: {
        type: String,
    },
    ballance: {
        required: true,
        type: Number,
    },
});

module.exports = mongoose.model('transaction', transactionSchema);
