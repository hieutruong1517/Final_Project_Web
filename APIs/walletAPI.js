var express = require('express');
var router = express.Router();
var nodemailer = require('nodemailer');
const mongoose = require('mongoose');
require('dotenv').config();
var { authenticateToken } = require('../APIs/token');

const wallet = require('../models/wallet');
const transaction = require('../models/transaction');
const user = require('../models/user');
const OTP = require('../models/OTP');
//Vì đồ án chỉ có 3 thẻ credit card thôi nên nhóm chúng em lưu vào đây để thầy không phải khởi tạo ạ.
const creditCards = [
    {
        creditCardNumber: '111111',
        creditCardExpiration: '2022-10-10',
        creditCardCVV: '411',
    },
    {
        creditCardNumber: '222222',
        creditCardExpiration: '2022-11-11',
        creditCardCVV: '443',
    },
    {
        creditCardNumber: '333333',
        creditCardExpiration: '2022-12-12',
        creditCardCVV: '577',
    },
];

//Hàm này dùng để lấy số dư hiện tại của tài khoản ra.
async function getCurrentballance(userEmail) {
    try {
        const currentballance = await wallet.aggregate([
            { $match: { userEmail: userEmail } },
            {
                $project: {
                    ballance: 1,
                },
            },
        ]);
        return currentballance[0].ballance;
    } catch (err) {
        console.log(err);
        return;
    }
}

router.post('/add/:userEmail', authenticateToken, async (req, res) => {
    let userEmail = req.params.userEmail;
    let moneyToAdd = req.body.amount;
    let creditCardNumber = req.body.creditCardNumber;
    let creditCardExpiration = req.body.creditCardExpiration;
    let creditCardCVV = req.body.creditCardCVV;

    if (moneyToAdd <= 0) {
        return res.status(422).json({ message: 'Invalid money' });
    }

    let isValid = false;

    //Validate credit card information
    for (var i = 0; i < creditCards.length; i++) {
        if (
            creditCardNumber == creditCards[i].creditCardNumber &&
            creditCardExpiration == creditCards[i].creditCardExpiration &&
            creditCardCVV == creditCards[i].creditCardCVV
        ) {
            isValid = true;
        }
    }

    if (!isValid) {
        return res.status(422).json({ message: 'Thông tin thẻ không hợp lệ' });
    }

    try {
        const addMoneyToCC = await wallet.findOneAndUpdate(
            { userEmail: userEmail },
            { $inc: { ballance: moneyToAdd } },
            { new: true },
        );
        const newTrans = new transaction({
            userEmail: userEmail,
            transDate: new Date(),
            transType: 'Nạp tiền',
            transStatus: 'Thành công',
            transMoney: moneyToAdd,
            ballance: addMoneyToCC.ballance,
        });
        await newTrans.save((err, result) => {
            if (err) throw err;
        });
        return res.status(200).send({message: `Nạp tiền thành công`, status: `Thành công`, money: newTrans.transMoney});
    } catch (error) {
        return res.status(400).send({ message: `Nạp tiền thất bại`, status: `Thất bại`, error: error.message });
    }
});

router.post('/withdraw', authenticateToken, async (req, res) => {
    console.log('withdrawAmount');
    let userEmail = req.body.userEmail;
    let creditCardNumber = req.body.creditCardNumber;
    let creditCardExpiration = req.body.creditCardExpiration;
    let creditCardCVV = req.body.creditCardCVV;
    let withdrawAmount = req.body.amount;
    let transactionNote = req.body.note;

    //Kiểm tra xem Số tiền rút mỗi lần phải là bội số của 50,000 đồng hay không
    if (withdrawAmount % 50000 != 0) {
        return res
            .status(400)
            .send({ message: 'Số tiền rút mỗi lần phải là bội số của 50.000VND. Ví dụ như: 100.000VND' });
    }
    //Khai báo biến ballance để lấy số dư tài khoản ở querry dưới
    let ballance = 0;
    //Dùng aggregate để lấy ra wallet có userEmail hiện tại với 2 thông tin là ngày rút tiền cuối cùng và tổng số tiền trong tài khoản HIỆN CÓ.
    //Dùng await để đợi cho querry này chạy hết thì mới đến kiểm tra thông tin thẻ.
    try {
        const result = await wallet.aggregate([
            {
                $match: { userEmail: userEmail },
            },
            {
                $project: {
                    lastTimeWithdraw: 1,
                    ballance: 1,
                    withdrawalsToday: 1,
                    numOfDays: {
                        //Dùng $dateDiff để trừ ngày rút tiền cuối cùng với ngày hiện tại. Nếu >= 2 thì không cho rút tiền. (vì 1 ngày chỉ được rút 2 lần)
                        $dateDiff: {
                            startDate: '$lastTimeWithdraw',
                            endDate: new Date(),
                            unit: 'day',
                        },
                    },
                },
            },
        ]);
        console.log(`line 138`);
        //Lấy số dư tài khoản HIỆN TẠI để phục vụ cho việc lưu lịch sử ở dưới.
        //(Không dùng hàm getCurrentballance vì đã querry ra rồi thì dùng luôn, không querry lại tránh mất thời gian)
        ballance = result[0].ballance;
        if (result[0].ballance <= 0) {
            return res.status(400).send({
                message: 'Số tiền trong tài khoản hiện tại bằng 0. Không thể tiếp tục giao dịch',
            });
        }
        //Kiểm tra xem lần rút tiền gần nhất có >= 2 ngày hay không. Nếu nhỏ hơn thì cho rút, không thì không cho.
        //Nếu số ngày = 0 (đang trong ngày) thì update withdrawalsToday (Số lần rút tiền trong ngày)
        if (result[0].numOfDays == 0 && result[0].withdrawalsToday < 2) {
            await wallet.findOneAndUpdate(
                { userEmail: userEmail },
                {
                    $inc: {
                        withdrawalsToday: 1,
                    },
                },
                { new: true },
            );
        } else if (result[0].numOfDays == 0 && result[0].withdrawalsToday >= 2) {
            return res.status(200).json({
                message: `Số lần rút tiền đã đạt giới hạn tối đa (2 lần 1 ngày). Xin quý khách vui lòng quay lại vào ngày mai`,
            });
        } else if (result[0].numOfDays > 0) {
            //Reset lại số lần rút trong ngày khi qua ngày tiếp theo
            await wallet.findOneAndUpdate(
                { userEmail: userEmail },
                //Thay vì reset lại 0 chúng ta phải reset lại = 1. Vì đây đã được tính là lần rút tiền đầu tiên trong ngày
                { withdrawalsToday: 1 },
                { new: true },
            );
        }
    } catch (err) {
        return res.status(400).send({ message: 'Lỗi xảy ra khi truy vấn mongoDB!' + err.message });
    }

    //Kiểm tra xem thông tin thẻ đã đúng chưa.
    console.log('222');
    if (
        creditCardNumber == '111111' &&
        creditCardExpiration == '2022-10-10' &&
        creditCardCVV == '411'
    ) {
        console.log('00');
        //Cộng thêm phí 5%
        withdrawAmount = withdrawAmount * 1 + withdrawAmount * 0.05;

        let transStatus = 'Thành công';
        //Nếu giao dịch lớn hơn 5.000.000VND thì phải đợi admin duyệt
        if (withdrawAmount > 5000000) {
            //Lưu vào lịch sử giao dịch là "Đang chờ duyệt". Bên admin sẽ querry ra những user nào có transStatus là "Đang chờ duyệt" để duyệt
            transStatus = 'Đang chờ duyệt';
            const newTrans = new transaction({
                userEmail: userEmail,
                transDate: new Date(),
                transType: 'Rút tiền',
                transStatus: transStatus,
                transMoney: withdrawAmount * -1,
                transNote: transactionNote,
                ballance: ballance,
            });
            await newTrans.save(function (err, result) {
                if (err) throw err;
                return res.status(200).send({
                    message: `Giao dịch của bạn đang chờ duyệt bởi admin`,
                });
            });
        }
        console.log(`Transstatus line 208 ${transStatus}`);
        //Nếu như rút < 5 triệu thì transStatus vẫn là "Không cần duyệt"
        if (transStatus === 'Thành công') {
            console.log('9');
            //Tìm wallet có userEmail hiện tại và dùng $inc * -1 để trừ đi số tiền trong ví.
            wallet.findOneAndUpdate(
                { userEmail: userEmail },
                {
                    $inc: { ballance: withdrawAmount * -1 },
                    //lastTimeWithdraw: new Date(),
                    lastTimeWithdraw: new Date(),
                },
                { new: true },
                (err, result) => {
                    if (err) throw err;
                    //Sau khi đã findOneAndUpdate xong thì lưu vào lịch sử giao dịch (transaction)
                    const newTrans = new transaction({
                        userEmail: userEmail,
                        transDate: new Date(),
                        transType: 'Rút tiền',
                        transStatus: transStatus,
                        transMoney: withdrawAmount * -1,
                        transNote: transactionNote,
                        ballance: result.lastTimeWithdraw,
                    });
                    newTrans.save(async function (err, result) {
                        if (err) throw err;
                        //Đợi có result trả về để chắc chắn rằng lệnh save đã chạy xong.
                        await result;
                    });
                    console.log(`line 238`);
                    //Sau khi lưu xong lịch sử giao dịch thì trả về result
                    return res.status(200).send({ result, success: true });
                },
            );
        }
    } else {
        return res.status(422).json({ message: 'Thông tin thẻ không hợp lệ' });
    }
});

//Xử lý thông tin người dùng submit trên form.
router.post('/moneyTransfer/:userEmail', authenticateToken, async (req, res) => {
    let userEmail = req.params.userEmail;

    let receiverEmail = req.body.email;
    let receiverPhoneNum = req.body.phoneNumber;
    let transMoney = req.body.transMoney;
    let note = req.body.note;
    let feeBearer = req.body.feeBearer;

    let currentballance = await getCurrentballance(userEmail);

    //Phí chuyển tiền là 5% số tiền cần chuyển
    let transFee = transMoney * 0.05;
    let emailHTML = '';

    console.log(transMoney > 5000000);
    //Nếu số tiền chuyển lớn hơn 5000000 thì lưu vào transaction với status là đang chờ duyệt.
    //Bên Admin sẽ querry ra và chấp thuận/từ chối giao dịch
    if (transMoney > 5000000) {
        const newTrans = new transaction({
            userEmail: userEmail,
            transDate: new Date(),
            transType: 'Chuyển tiền',
            transStatus: 'Đang chờ duyệt',
            transMoney: transMoney * 1,
            transNote: `Giao dịch chuyển tiền đến ${receiverPhoneNum}`,
            ballance: currentballance,
        });
        console.log(`save thành công ${newTrans}`);

        await newTrans.save(function (err, result) {
            if (err) throw err;
            emailHTML = `<h1>Bạn vừa yêu cầu chuyển tiền tới tài khoản ${receiverPhoneNum}</h1>
                        <p>Số tiền bạn yêu cầu chuyển lớn hơn 5 triệu VND: <b>${parseInt(
                            transMoney,
                        ).toLocaleString()} VND</b>, phí giao dịch là <b>${parseInt(
                transFee,
            ).toLocaleString()} VND</b>.</p>
                        <h2>ADMIN đang duyệt giao dịch của bạn vì đây là giao dịch <b>lớn hơn 5 triệu VND</b></h2>
                        <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi</p>`;
            return res.status(200).send({message: `Đợi duyệt`});
        });
    }

    if (transMoney <= 5000000) {
        //let moneyWithCommas = parseInt(transMoney).toLocaleString();
        var generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        emailHTML = `<h1>Bạn vừa yêu cầu chuyển tiền tới tài khoản ${receiverPhoneNum}</h1>
                    <p>Số tiền yêu cầu chuyển là: <b>${parseInt(
                        transMoney,
                    ).toLocaleString()} VND</b>, phí giao dịch là <b>${parseInt(transFee).toLocaleString()} VND </b>
                    <h4>Mã OTP của bạn: ${generatedOTP}</h4>
                    <p>Xin lưu ý rằng mã này chỉ có <b>tác dụng trong 1 phút</b></p>`;

        //Gửi mail bằng nodemailer
        //Nhóm chúng em tạo tài khoản OUTLOOk để gửi mail. Tài khoản này gửi được hầu hết tất cả mail thông dụng 
        var transporter = nodemailer.createTransport({
            host: process.env.OUTLOOK_HOST,
            port: 587,
            secure: false,
            tls: {
                ciphers: 'SSLv3',
            },
            auth: {
                user: process.env.OUTLOOK_USERNAME,
                pass: process.env.OUTLOOK_PASSWORD,
            },
        });

        var mailOptions = {
            from: process.env.OUTLOOK_USERNAME,
            to: `${userEmail}`,
            subject: `Giao dịch chuyển tiền đến ${receiverPhoneNum}`,
            html: emailHTML,
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
                res.status(400).json({ message: `Lỗi xảy ra trong quá trình gửi mail: ${error}` });
            } else {
                console.log('Email sent: ' + info.response);
                res.status(200).json({ message: `Mail đã được gửi thành công` });
            }
        });

        try {
            await OTP.create({
                userEmail: userEmail,
                OTPCode: generatedOTP,
            });
            return res.status(200).send({ message: `Tạo OTP thành công`, otpCreated: true });
        } catch (err) {
            console.log(err);
            return res.status(400).json({ message: `Lỗi mongoDB khi insert OTP: ${err}` });
        }
    }
});

//Xử lý OTP
router.post('/authOTP', authenticateToken, async (req, res) => {
    let OTPCode = req.body.otp;

    OTP.findOne({ OTPCode: OTPCode }, (err, otp) => {
        if (err || otp == null) {
            return res.status(410).send({ message: `Mã OTP đã hết thời gian`, success: false });
        }
        if (otp.OTPCode === OTPCode) {
            OTP.deleteOne({ OTPCode: otp.OTPCode }, (err) => {
                if (err) throw err;
            }); 
            return res.status(200).send({ message: 'Mã OTP hợp lệ', success: true });
        } else {
            return res.status(200).send({ message: 'Mã OTP không hợp lệ', success: false });
        }
        
    });
});

//Thông báo khi tài khoản được nhận tiền
router.post('/notification/:phoneNum', async (req, res) => {
    let userEmail;
    let senderPhoneNum = req.body.phoneNumber
    let emailToNotify;
    let currentBallance;
    let transMoney = req.body.transMoney;

    
    try {
        //Lấy ra email dựa theo số điện thoại
        await wallet.findOne({ userPhone: req.params.phoneNum }, (err, userWallet) => {
            if (err) {
                return res.status(400).send({ message: err.message});
            }
            if (userWallet) {
                emailToNotify = userWallet.userEmail
                currentBallance = userWallet.userPhone
                userEmail = userWallet.userEmail
            }
        })  
        const newTrans = new transaction({
            userEmail: userEmail,
            transDate: new Date(),
            transType: 'Nhận tiền',
            transStatus: 'Thành công',
            transMoney: transMoney * 1,
            transNote: `Nhận tiền từ ${senderPhoneNum}`,
            ballance: currentBallance
        })
        await newTrans.save((err, result) => {
            if (err) throw err;
            res.status(200).send({ message: `Lưu lịch sử nhận tiền thành công`})
        })
    } catch (err) {
        return res.status(400).send({ message: `Có lỗi trong quá trình thông báo: ${err.message}`, });
    }
    var transporter = nodemailer.createTransport({
            host: process.env.OUTLOOK_HOST,
            port: 587,
            secure: false,
            tls: {
                ciphers: 'SSLv3',
            },
            auth: {
                user: process.env.OUTLOOK_USERNAME,
                pass: process.env.OUTLOOK_PASSWORD,
            },
        });

        var mailOptions = {
            from: process.env.OUTLOOK_USERNAME,
            to: `${emailToNotify}`,
            subject: `Bạn vừa nhận được tiền từ ${senderPhoneNum} `,
            html: `<h1>Số dư tài khoản hiện tại: +${currentballance}</h1>`,
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
                res.status(400).json({ message: `Lỗi xảy ra trong quá trình gửi mail: ${error}` });
            } else {
                console.log('Email sent: ' + info.response);
                return res.status(200).send({ message: `Mail đã được gửi thành công`, success: true });
            }
        });
})

router.post('/buyCard/:userEmail', authenticateToken, async (req, res) => {
    console.log(`line 450 called`);
    let userEmail = req.body.userEmail;
    let cardNetwork = req.body.network;
    let cardValue = req.body.cardValue;
    let transFee = req.body.transFee;
    let cardQuantity = req.body.quantity;

    let totalMoney = parseInt(cardValue) * parseInt(cardQuantity) + parseInt(transFee);

    //Lấy ra số dư hiện tại của tài khoản
    let currentballance = await getCurrentballance(userEmail);

    //Kiểm tra xem trong tài khoản có đủ tiền để mua thẻ cào hay không
    if (currentballance < totalMoney) {
        return res.status(400).send({
            message: `Số tiền ${currentballance} hiện có trong tài khoản của quý khách không đủ để thực hiện giao dịch này!`,
        });
    }

    try {
        const result = await wallet.findOneAndUpdate(
            { userEmail: userEmail },
            {
                $inc: { ballance: totalMoney * -1 },
            },
            { new: true },
        );

        //Sau khi trừ tiền mua thẻ cào xong thì generate mã thẻ để trả về + lưu lịch sử giao dịch

        //Code là 5 số cuối được random
        let code = Math.floor(Math.random() * 90000) + 10000;

        let cardCode = '';
        if (cardNetwork == 'Viettel') {
            cardCode = '11111' + code.toString();
        } else if (cardNetwork == 'Mobifone') {
            cardCode = '22222' + code.toString();
        } else if (cardNetwork == 'Vinaphone') {
            cardCode = '33333' + code.toString();
        } else {
            return res.status(400).json({ message: 'Nhà mạng không tồn tại' });
        }

        const newTrans = new transaction({
            userEmail: userEmail,
            transDate: new Date(),
            transType: `Mua thẻ cào ${cardNetwork}`,
            transStatus: 'Thành công',
            transMoney: totalMoney * -1,
            transNote: `Mã thẻ cào: ${cardCode}`,
            ballance: result.ballance,
        });

        newTrans.save(async function (err, result) {
            if (err) throw err;
            //Sauconsole.log('4');
            await result;
            //console.log('5');
        });

        const returnForClient = {
            cardCode: `${cardCode}`,
            money: `${totalMoney}`,
            buyDate: `${newTrans.transDate}`,
            currentBallance: `${newTrans.ballance}`,
        };

        return res.status(200).send({cardInfo: returnForClient, success: true});
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});


router.post('/history/:userEmail', authenticateToken, async (req, res) => {
    let userEmail = req.params.userEmail
    try {
        const allHistory = await transaction.find({ userEmail: { $in: userEmail } });
        return res.status(200).send({history: allHistory, success: true});
    
    } catch (err) {
        return res.status(422).send({ message: 'Lỗi mongoDB', success: false});
    }
    
})

module.exports = router;
