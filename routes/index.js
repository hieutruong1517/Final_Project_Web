var express = require('express');
var router = express.Router();
var fetch = require('node-fetch');
const url = require('url');
var { authenticateToken } = require('../APIs/token');
var walletAPI = 'http://localhost:3000/wallet';
var userAPI = 'http://localhost:3000/users';

var User = require('../models/user');

//const cors = require('cors');

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', (req, res) => {
    let formData = {
        email: req.body.email,
        phone: req.body.phone,
        fullname: req.body.fullname,
        birthdate: req.body.birthdate,
        address: req.body.address,
    };

    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };

    fetch(userAPI + '/register', options)
        .then((res) => res.json())
        .then((data) => {
            if (data.user != null) {
                res.redirect('/login');
            } else {
                res.redirect('/register');
            }
        });
});

router.post('/login', (req, res) => {
    let formData = {
        email: req.body.email,
        password: req.body.password,
    };
    let options = {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };
    fetch(userAPI + '/login', options)
        .then((res) => {
            return res.json();
        })
        .then((data) => {
            if (data.LAST_LOGIN == null) {
                res.cookie('JWT', `${data.token}`, {
                    maxAge: 15 * 60 * 1000, //hết hạn trong 15p
                    httpOnly: true, // cookie chỉ truy cập được bằng web server
                    secure: true, // xác định nếu cookie được signed chưa
                });
                req.session.myJWT = data.token;
                res.redirect('/changeFirstPass/' + data.userEmail);
            }
            2;
            if (data.msg === 'Đăng nhập thành công') {
                console.log(`thanh cong`);
                req.session.userEmail = data.userEmail;
                req.session.myJWT = data.token;
                res.cookie('JWT', `${data.token}`, {
                    maxAge: 1000 * 60 * 30,
                    httpOnly: true,
                    secure: true,
                });
                res.redirect(`/${data.userEmail}`);
            }
        });
});

router.get('/info/:email', authenticateToken, (req, res) => {
    var email = req.params.email;
    User.findOne({ email: email }, (err, user) => {
        if (err) throw err;

        if (!user) return res.json({ success: false, msg: 'Không tìm thấy user' });
        console.log(user);

        res.render('account-info', { user: user, date: user.birthdate.toISOString().substring(0, 10) });
    });
});

router.get('/changePass/:email', authenticateToken, (req, res) => {
    var email = req.params.email;
    res.render('change-password', { email: email });
});

router.post('/changePass', authenticateToken, (req, res) => {
    let formData = {
        oldPass: req.body.oldPass,
        password1: req.body.password1,
        password2: req.body.password2,
        email: req.body.email,
        token: req.session.myJWT,
    };
    let options = {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };

    fetch(userAPI + '/changePass', options)
        .then((res) => res.json())
        .then((data) => {
            if (data.msg == 'Đổi mật khẩu thành công') {
                res.redirect('/');
            } else {
                req.session.sessionFlash = {
                    type: 'error',
                    message: `${data.msg}`,
                };
                res.redirect('/changePass/' + data.email);
            }
        });
});

router.get('/withdraw/:userEmail', authenticateToken, function (req, res) {
    var userEmail = req.params.userEmail;
    console.log(userEmail);
    res.render('withdraw-money', { email: userEmail });
});

router.post('/withdraw/:userEmail', authenticateToken, function (req, res) {
    let userEmail = req.params.userEmail;
    let formData = {
        userEmail: userEmail,
        creditCardNumber: req.body.creditCardNumber,
        creditCardExpiration: req.body.creditCardExpiration,
        creditCardCVV: req.body.creditCardCVV,
        amount: req.body.withdrawAmount,
        note: req.body.note,
        token: req.session.myJWT,
    };
    console.log(formData);
    let options = {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };

    fetch(walletAPI + '/withdraw', options)
        .then((res) => res.json())
        .then((data) => {
            console.log(`data la ${data.message}`);
            if (data.success === true) {
                console.log(`line 120 thanh cong`);
                res.redirect(`/${userEmail}`);
            } else {
                req.session.sessionFlash = {
                    type: 'error',
                    message: `${data.message}`,
                };
                res.redirect(`/withdraw/${userEmail}`);
            }
        });
});

router.get('/transMoney/:userEmail', authenticateToken, (req, res) => {
    let userEmail = req.params.userEmail;
    res.render('transfer-money', { email: userEmail });
});

router.post('/transMoney/:userEmail', authenticateToken, (req, res) => {
    let userEmail = req.params.userEmail;
    let formData = {
        userEmail: userEmail,
        receiverEmail: req.body.email,
        phoneNumber: req.body.phoneNumber,
        transMoney: req.body.transMoney,
        note: req.body.note,
        feeBearer: req.body.feeBearer,
        token: req.session.myJWT,
    };
    //console.log(`adadada ${JSON.stringify(formData)}`);
    //console.log(formData);
    let options = {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };

    fetch(walletAPI + `/moneyTransfer/${userEmail}`, options)
        .then((res) => res.json())
        .then((data) => {
            console.log(`data la ${data.message}`);
            if (data.message == 'Đợi duyệt') {
                req.session.sessionFlash = {
                    type: 'error',
                    message: `${data.message}`,
                };
                res.redirect(`/transMoney/${userEmail}`);
            } else if (data.otpCreated == true) {
                req.session.transMoney = formData.transMoney;
                return res.redirect(`/transOTP/${formData.phoneNumber}`);
            }
        });
});

router.get('/uploadImg/:email', (req, res) => {
    var email = req.params.email;
    res.render('upload-cmnd', { email: email });
});


router.get('/transOTP/:phoneNum', authenticateToken, (req, res) => {
    let phoneNum = req.params.phoneNum;
    res.render('transOTP', { phoneNum: phoneNum, email: req.session.userEmail });
});

router.post('/transOTP/:phoneNum', authenticateToken, (req, res) => {
    let userEmail = req.session.userEmail;
    let senderPhoneNum = req.params.phoneNum;
    let receiverPhoneNum = req.body.phoneNum;
    let options = {
        method: 'POST',
        credentials: true,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: req.session.myJWT, otp: req.body.otp }),
    };

    fetch(walletAPI + `/authOtp`, options)
        .then((res) => res.json())
        .then((data) => {
            if (data.success === true) {
                req.session.receiverPhoneNum = receiverPhoneNum;
                return res.redirect(`/transNotify/${senderPhoneNum}`);
            } else {
                req.session.sessionFlash = {
                    type: 'error',
                    message: `${data.message}`,
                };
                res.redirect(`/transOTP/${userEmail}`);
            }
        });
});

router.get('/transNotify/phoneNum', function (req, res) {
    console.log('kdkjaskdjasdsa');
    let senderPhoneNum = req.params.phoneNum;
    let receiverPhoneNum = req.session.receiverPhoneNum;
    fetch(walletAPI + `/notification/${receiverPhoneNum}`, {
        method: 'POST',
        credentials: true,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            phoneNumber: senderPhoneNum,
            transMoney: req.session.transMoney,
            token: req.session.myJWT,
        }),
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.success === true) {
                console.log('read');
                delete req.session.transMoney;
                delete req.session.receiverPhoneNum;
                res.redirect('/');
            } else {
                req.session.sessionFlash = {
                    type: 'error',
                    message: `${data.message}`,
                };
                res.redirect(`/transOTP/${userEmail}`);
            }
        });
})

router.get('/history/:userEmail', authenticateToken, (req, res) => {
    let userEmail = req.params.userEmail;
    let options = {
        method: 'POST',
        credentials: true,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: req.session.myJWT }),
    };
    fetch(walletAPI + `/history/${userEmail}`, options)
        .then((res) => res.json())
        .then((data) => {
            if (data.success === true) {
                console.log(`line 187 thanh cong`);
                console.log(data.history);
                res.render('history', { history: data.history, email: userEmail });
            } else {
                res.redirect('/');
            }
        });
});

router.get('/buyCard/:userEmail', authenticateToken, (req, res) => {
    let userEmail = req.params.userEmail;
    res.render('buy-card', { email: userEmail });
});

router.get('/changeFirstPass/:userEmail', authenticateToken, (req, res) => {
    var userEmail = req.params.userEmail;
    res.render('changeFirstPass', { email: userEmail });
});

router.post('/buyCard/:userEmail', authenticateToken, (req, res) => {
    var userEmail = req.params.userEmail;
    let network = req.body.operator;
    let cardValue = req.body.price;
    let transFee = req.body.transFee;
    let quantity = req.body.quantity;

    let formData = {
        userEmail: userEmail,
        network: network,
        cardValue: cardValue,
        transFee: transFee,
        quantity: quantity,
        token: req.session.myJWT,
    };
    let options = {
        method: 'POST',
        credentials: true,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
    };

    fetch(walletAPI + `/buyCard/${userEmail}`, options)
        .then((res) => res.json())
        .then((data) => {
            if (data.success === true) {
                console.log(`line 120 thanh cong`);
                res.redirect(`/${userEmail}`);
            } else {
                req.session.sessionFlash = {
                    type: 'error',
                    message: `${data.message}`,
                };
                res.redirect(`/withdraw/${userEmail}`);
            }
        });
});

router.post('/changeFirstPass', authenticateToken, (req, res) => {
    let formData = {
        pass1: req.body.password1,
        pass2: req.body.password2,
        email: req.body.email,
        token: req.session.myJWT,
    };
    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };
    //console.log(`line 118: ${formData.pass1}`);
    fetch(userAPI + '/changeFirstPass', options)
        .then((res) => {
            return res.json();
        })
        .then((data) => {
            console.log(`data.msg là: ${data.msg}`);
            if (data.msg == 'Đổi mật khẩu thành công') {
                req.session.myJWT = data.token;
                res.redirect('/' + data.userEmail);
            } else {
                res.redirect('/changeFirstPass/' + data.userEmail);
            }
        });
});

router.get('/forgetPass', (req, res) => {
    res.render('restore-password');
});

router.post('/forgetPass', (req, res) => {
    let formData = {
        email: req.body.email,
    };
    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };

    fetch(userAPI + '/forgetPass', options)
        .then((res) => res.json())
        .then((data) => {
            if (data.success === true) {
                res.redirect('/authOtp');
            } else {
                res.redirect('/forgetPass');
            }
        });
});

router.get('/authOtp', (req, res) => {
    res.render('enter-otp');
});

router.post('/authOtp', (req, res) => {
    let formData = {
        otp: req.body.otp,
    };
    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };

    fetch(userAPI + '/authOtp', options)
        .then((res) => res.json())
        .then((data) => {
            if (data.msg == 'Mã OTP hợp lệ') {
                console.log(`Mã OTP hợp lệ`);
                console.log(`Đường dẫn: /newPass/${data.email}`);
                res.redirect('/newPass/' + data.email);
            } else {
                res.redirect('/forgetPass');
            }
        });
});

router.get('/newPass/:email', (req, res) => {
    var email = req.params.email;
    res.render('newPass', { email: email });
});

router.post('/newPass', (req, res) => {
    let formData = {
        pass1: req.body.password1,
        pass2: req.body.password2,
        email: req.body.email,
    };
    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    };

    fetch(userAPI + '/newPass', options)
        .then((res) => res.json())
        .then((data) => {
            if (data.msg == 'Đổi mật khẩu thành công') {
                return res.redirect('/' + data.email);
            } else {
                req.session.sessionFlash = {
                    type: 'error',
                    message: `OTP hết thời gian`,
                };
                return res.redirect('/newPass/' + formData.email);
            }
        });
});

router.get('/', authenticateToken, (req, res) => {
    let userEmail = req.session.userEmail;
    console.log(`userEmal: ${userEmail}`);
    if (!req.session.myJWT) {
        res.redirect('login');
    }
    return res.redirect(`/${userEmail}`);
});

router.get('/:userEmail', authenticateToken, (req, res) => {
    let userEmail = req.params.userEmail;
    if (!req.session.myJWT) {
        res.redirect('login');
    }
    return res.render('home', { userEmail });
});

router.get('/addMoney/:userEmail', authenticateToken, async (req, res) => {
    let userEmail = req.params.userEmail;

    res.render('addMoney', { userEmail });
});

router.post('/addMoney/:userEmail', authenticateToken, async (req, res) => {
    let userEmail = req.params.userEmail;
    console.log(`token session ${req.session.myJWT}`);

    let formData = {
        amount: req.body.amount,
        creditCardNumber: req.body.creditCardNumber,
        creditCardExpiration: req.body.creditCardExpiration,
        creditCardCVV: req.body.creditCardCVV,
        token: req.session.myJWT,
    };
    let options = {
        method: 'POST',
        credentials: true,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
    };

    fetch(walletAPI + `/add/${userEmail}`, options)
        .then((res) => res.json())
        .then((data) => {
            if (data.status == `Thành công`) {
                res.redirect(`/${req.session.userEmail}`);
            } else {
                req.session.sessionFlash = {
                    type: 'error',
                    message: `${data.message}`,
                };
                res.redirect(`/addMoney/${userEmail}`);
            }
        });
});

module.exports = router;
