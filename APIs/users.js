var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var User = require('../models/user');
const wallet = require('../models/wallet');
var nodemailer = require('nodemailer'); //send mail module
const bcrypt = require('bcrypt');
const saltRounds = 10;
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
dotenv.config();
var { authenticateToken } = require('../APIs/token');
const async = require('hbs/lib/async');
const apis = require('../APIs/userapi');
const cors = require('cors');

const Otp = require('../models/OTP');

const multer = require('multer');
fs = require('fs');
const path = require('path');
const { log } = require('console');

// kết nối với database
//mongoose.connect("mongodb://localhost:27017/usersDB", { useNewUrlParser: true });

// tạo token
function generateAccessToken(email) {
    return jwt.sign(email, process.env.TOKEN_SECRET, { expiresIn: '1800s' });
}

// hàm tạo password ngẫu nhiên ban đầu
function generatedPass(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/* Trang chủ chính */
router.get('/api/:username', authenticateToken, function (req, res, next) {
    var username = req.params.username;

    User.findOne({ username: username }, (err, user) => {
        if (err || !user) throw err;

        User.findOneAndUpdate({ username: username }, { LAST_LOGIN: Date.now() }, { new: true }, (err) => {
            if (err) return res.json({ success: false, msg: err });
            // console.log(user)
            res.status(200).json({ user: user });
        });
    });
});

// xử lý đường dẫn tới register
router.get('/register', (req, res) => {
    res.render('register');
});

// đăng ký tài khoản
router.post('/register', async (req, res, next) => {
    let username = Math.floor(1000000000 + Math.random() * 9000000000);
    let password = generatedPass(6);
    let email = req.body.email;

    let user = new User({
        email: email,
        phone: req.body.phone,
        fullname: req.body.fullname,
        birthdate: req.body.birthdate,
        address: req.body.address,
        username: username,
        password: password,
        isLocked: false,
        // frontImg: req.body.frontImg,
        // backImg: req.body.backImg,
    });

    // tiến hành mã hóa mật khẩu, với saltRounds = 10
    // try {
    //     User.findOne({ email: user.email }, async (err, user) => {
    //         if (err) throw err;
    //         await user
    //         if (user != null) {
    //             return res.status(400).send({ msg: `Đã có tài khoản với email này`, success: false});
    //         }
    //     })
    //     User.findOne({ phone: user.phone }, async (err, user) => {
    //         if (err) throw err;
            
    //         if (user) {
    //             return res.status(400).send({ msg: `Đã có tài khoản với SDT này`, success: false });
    //         }
    //     });
    // } catch (e) {
    //     return res.status(400).send({ msg: e.message, success: false });
    // }


    try {
        bcrypt.hash(user.password, saltRounds).then((hash) => {
            user.password = hash;
            user.save((err) => {
                if (err) throw err;
                const token = generateAccessToken({ email: email });
                // res.json({ sucess: true, user: user });
                const newWallet = new wallet({
                    userEmail: user.email,
                    userPhone: user.phone,
                    ballance: 0 * 1,
                    lastTimeWithdraw: new Date(),
                    withdrawalsToday: 0,
                });
                newWallet.save(async function (err, result) {
                    if (err) throw err;
                    await result;
                });

                res.status(201).json({ msg: 'Tạo tài khoản thành công', user: user });
                //res.render('login');
            });
        });
    } catch (err) {
        return res.status(400).send({ msg: err.message, success: false });
    }

    // tạo ra một transporter object để sử dụng SMTP
    var transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false, // true với port 465, false với những port khác
        // ignoreTLS: true, // không dùng tls
        tls: {
            ciphers: 'SSLv3',
        },
        auth: {
            //thông tin của mail dùng để gửi
            user: 'group1WebAdvanced@outlook.com',
            pass: 'dxboukbdfinfvcoy',
        },
    });

    // tạo ra một mail object chứa những thông tin gửi đi (bao gồm địa chỉ gửi và nhận)
    var mailOptions = {
        from: 'group1WebAdvanced@outlook.com',
        to: `${user.email}`, // truyền vô email người dùng nhập vào
        subject: 'Thông tin tài khoản',
        text: 'Username: ' + username + ', password: ' + password,
    };

    // gửi mail
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.log(err);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
});

// xử lý đăng nhập
router.post('/login', (req, res) => {
    var email = req.body.email;
    var password = req.body.password;

    User.findOne({ email: email }, (err, user) => {
        if (err || !user) {
            console.log();
            return res.json({ success: false, msg: 'Sai thông tin' });
        }
        bcrypt.compare(password, user.password).then((result) => {
            if (result) {
                const token = generateAccessToken({ email: email });

                //console.log('token: ' + token)
                if (user.isLocked) {
                    res.status(422).json({ msg: 'Tài khoản bị khóa' });
                }
                if (user.LAST_LOGIN === null) {
                    return res
                        .status(200)
                        .json({ msg: 'Đăng nhập lần đầu', LAST_LOGIN: user.LAST_LOGIN, userEmail: user.email, token });
                } else {
                    console.log('success');
                    res.cookie('JWT', `${token}`, {
                        maxAge: 1000 * 60 * 15, // would expire after 15 minutes
                        httpOnly: true, // The cookie only accessible by the web server
                        secure: true, // Indicates if the cookie should be signed
                    });
                    return res
                        .status(200)
                        .setHeader('x-csrf-token', `${token}; HttpOnly`)
                        .send({
                            msg: 'Đăng nhập thành công',
                            LAST_LOGIN: user.LAST_LOGIN,
                            token,
                            userEmail: user.email,
                        });
                }
            } else {
                return res.status(422).json({ msg: 'Sai mật khẩu' });
            }
        });
    });
});

router.get('/changePass/:username', authenticateToken, async (req, res) => {
    var username = req.params.username;
    User.findOne({ username: username }, (err, user) => {
        if (err || !user) return res.status(400).json({ msg: err });

        res.render('changePass', { email: user.email });
    });
});

// đổi mật khẩu khi đăng nhập lần đầu tiên
router.post('/changeFirstPass', authenticateToken, (req, res) => {
    console.log(`Da dc gọi`);

    var pass1 = req.body.pass1;
    console.log(`pass1: ${pass1}`);
    var pass2 = req.body.pass2;
    var email = req.body.email;

    if (pass1 != pass2) {
        console.log(`sai thong tin`);
        return res.status(422).send({ msg: 'Mật khẩu mới không trùng khớp với nhau' });
    }

    User.findOne({ email: email }, async (err, user) => {
        if (err || !user) {
            console.log(`errr`);
            return res.status(422).send({ msg: 'Sai thông tin' });
        }

        // so sánh mật khẩu mới với mật khẩu cũ
        // nếu trùng thì sẽ không cho thay đổi và báo lỗi
        console.log(`pass1: ${pass1}, user.passowrd: ${user.password}`);
        bcrypt.compare(pass1, user.password).then((result) => {
            if (result) {
                return res.status(422).send({ msg: 'Mật khẩu mới không được trùng với mật khẩu cũ' });
            }
        });

        var newPass = await bcrypt.hash(pass1, saltRounds);

        User.findOneAndUpdate(
            { email: email },
            { password: newPass, LAST_LOGIN: new Date() },
            { new: true },
            async (err, user) => {
                if (err) throw err;
                // fetch(url + '/homepage', {
                //   method: 'GET',
                //   headers: myHeaders,
                // }).then(
                //   res.redirect('/' + user.email)
                // )

                return res.status(200).send({ msg: 'Đổi mật khẩu thành công', userEmail: user.email });
            },
        );
    });
});

// đổi mật khẩu
router.post('/changePass', authenticateToken, (req, res) => {
    var oldPass = req.body.oldPass;
    var pass1 = req.body.password1;
    var pass2 = req.body.password2; /* Xác nhận mật khẩu mới */
    var email = req.body.email;

    console.log(`
        oldPass: ${oldPass},
        pass1: ${pass1},
        pass2: ${pass2},
        email: ${email}
    `);
    // Mật khẩu mới và xác nhận mật khẩu phải trùng khớp với nhau
    if (pass1 != pass2) {
        return res.status(422).json({ msg: 'Mật khẩu mới không trùng khớp với nhau' });
    }
    console.log(`line 268`);
    User.findOne({ email: email }, async (err, user) => {
        if (err || !user) {
            throw err;
        }
        console.log(`line 273`);
        // kiểm tra nhập mật khẩu cũ đúng hay không
        bcrypt.compare(oldPass, user.password).then((result) => {
            if (!result) return res.status(422).json({ msg: 'Sai mật khẩu cũ' });
        });
        console.log(`line 278`);
        // kiểm tra mật khẩu mới có giống mật khẩu cũ hay không
        bcrypt.compare(pass1, user.password).then((result) => {
            if (result) {
                return res.status(422).json({ msg: 'Mật khẩu mới không được trùng với mật khẩu cũ' });
            }
        });
        console.log(`line 285`);
        // hash mật khẩu mới và cập nhật vào db
        var newPass = await bcrypt.hash(pass1, saltRounds);

        User.findOneAndUpdate({ email: email }, { password: newPass }, { new: true }, (err) => {
            if (err) throw err;
            res.status(200).json({ msg: 'Đổi mật khẩu thành công' });
        });
    });
});

router.get('/forgetPass', (req, res) => {
    res.render('restore-password');
});

// xử lý khôi phục mật khẩu khi quên
router.post('/forgetPass', (req, res) => {
    var email = req.body.email;
    User.findOne({ email: email }, (err, user) => {
        if (err) throw err;
        if (!user) return res.status(422).json({ msg: 'Email không hợp lệ' });

        // var now = new Date()
        var otp_code = Math.floor(100000 + Math.random() * 100000);
        let otp = new Otp({
            userEmail: email,
            OTPCode: otp_code,
            // expirationTime: new Date(now.getTime() + (1 * 60 * 1000))
        });

        otp.save((err) => {
            if (err) throw err;
        });

        // tạo ra một transporter object để sử dụng SMTP
        var transporter = nodemailer.createTransport({
            host: 'smtp.office365.com',
            port: 587,
            secure: false, // true for port 465, false for other ports
            tls: {
                ciphers: 'SSLv3',
            },
            auth: {
                user: 'group1WebAdvanced@outlook.com',
                pass: 'dxboukbdfinfvcoy',
            },
        });

        // tạo ra một mail object chứa những thông tin gửi đi (bao gồm địa chỉ gửi và nhận)
        var mailOptions = {
            from: 'group1WebAdvanced@outlook.com',
            to: `${email}`,
            subject: 'Mã OTP khôi phục mật khẩu',
            html: `<p>Mã OTP của bạn là <b>${otp.OTPCode}.</b></p>
            <p><b>Lưu ý:</b> OTP sẽ chỉ tổn tại trong vòng 1 phút.</p>`,
        };

        // gửi mail
        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.log(err);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
        return res.status(201).json({ msg: 'Tạo và gửi OTP thành công', success: true });
        // res.render('restore-password')
    });
});

// đổi mật khẩu sau khi nhập otp
router.post('/newPass', (req, res) => {
    var pass1 = req.body.pass1;
    var pass2 = req.body.pass2;
    var email = req.body.email;

    if (pass1 != pass2) {
        return res.status(422).json({ msg: 'Mật khẩu mới không trùng khớp với nhau' });
    }

    User.findOne({ email: email }, async (err, user) => {
        if (err || !user) {
            return res.status(422).json({ msg: 'Sai thông tin' });
        }

        // so sánh mật khẩu mới với mật khẩu cũ
        // nếu trùng thì sẽ không cho thay đổi và báo lỗi
        bcrypt.compare(pass1, user.password).then((result) => {
            if (result) {
                req.session.flash = {
                    type: 'danger',
                    intro: 'Validation error!',
                    message: 'Mật khẩu mới không được trùng với mật khẩu cũ',
                };

                return res.status(422).json({ msg: 'Mật khẩu mới không được trùng với mật khẩu cũ' });
            }
        });

        var newPass = await bcrypt.hash(pass1, saltRounds);

        User.findOneAndUpdate({ email: email }, { password: newPass }, { new: true }, (err) => {
            if (err) throw err;
            const token = generateAccessToken({ email: email });
            return res.status(200).json({
                success: true,
                msg: 'Đổi mật khẩu thành công',
                LAST_LOGIN: user.LAST_LOGIN,
                email: user.email,
                token: token,
            });
        });
    });
});

// xử lý otp người dùng nhập vào
router.post('/authOtp', (req, res) => {
    var otp = req.body.otp;
    Otp.findOne({ otp: otp.OTPCode }, (err, otp) => {
        if (err) throw err;

        if (!otp) return res.status(422).json({ msg: 'Mã OTP không hợp lệ' });

        // // xử lý otp quá hạn
        // var now = moment()
        // var expirationTime = moment(otp.expirationTime)
        // // res.json({now: now})
        // var result = now.diff(expirationTime, 'minutes')
        // if (result >= 1) {
        //   Otp.deleteOne({ otp: otp.otp }, (err) => {
        //     if (err) throw err
        //   })
        //   return res.status(410).json({ msg: 'Mã OTP đã hết thời gian' })
        // }

        // xóa token sau khi sử dụng (vì OTP là mật khẩu chỉ sử dụng 1 lần)
        Otp.deleteOne({ otp: otp.OTPCode }, (err) => {
            if (err) throw err;
        });

        return res.status(202).send({ msg: 'Mã OTP hợp lệ', email: otp.userEmail });
    });
});

// cấu hình multer để lưu ảnh upload
var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});

var upload = multer({ storage: storage });

// xử lý upload căn cước công dân
// upload.array('cmndPhotos', 2): với cmndPhotos là phần name của nơi up file ảnh: vd <input id="..." name="cmndPhotos">
// số 2 là số ảnh tối đa được upload
router.post('/uploadImg', upload.array('cmndPhotos', 2), (req, res) => {
    // ảnh mặt trước
    var frontImg = {
        data: fs.readFileSync(path.join(__dirname, '..', 'uploads', req.files[0].filename)), // đọc vị trí lưu ảnh
        contentType: req.files[0].mimetype, // đuôi file ảnh
    };
    var backImg = {
        data: fs.readFileSync(path.join(__dirname, '..', 'uploads', req.files[1].filename)),
        contentType: req.files[1].mimetype,
    };
    var email = req.body.email;

    // lưu thông tin ảnh vào database dựa vào email
    User.findOneAndUpdate({ email: email }, { frontImg: frontImg, backImg: backImg }, { new: true }, (err) => {
        if (err) throw err;

        res.json({ msg: 'Upload ảnh thành công' });
    });
});

// api khóa tài khoản
router.post('/api/lockAccount', (req, res) => {
    var email = req.body.email;
    User.findOneAndUpdate({ email: email }, { isLocked: true }, { new: true }, (err) => {
        if (err) throw err;

        return res.status(200).json({ msg: 'Đã khóa tài khoản' });
    });
});

module.exports = router;
