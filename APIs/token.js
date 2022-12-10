const User = require('../models/user');
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    console.log('Go in');

    try {
        var token
        console.log(req.body.token);
        if (req.body.token != null || req.body.token != undefined) {
            token = req.body.token
        } else {
            const token1 = req.headers.cookie.split('JWT=')[1];
            token = token1.split(';')[0].split('%')[0];
        }
        req.session.myJWT = token;
        if (token == null) return res.status(401);
        jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
            console.log(`line30`);
            if (err) {
                console.log('Lỗi authenticatEtoken: ' + err.message);
                return res.redirect('/login');
            }
            //console.log(user);
            User.findOne({ email: user.email }, (err, user) => {
                if (err || !user) {
                    // console.log(user)
                    return res.redirect('/login');
                    //return res.json({ success: false, msg: 'Chưa đăng nhập' });
                }
                console.log("Verify token thanh cong");
                req.session.userEmail = user.email;
                req.user = user;
                next();
            });
        });
    } catch (e) {
        return res.redirect('/login');
    }
}
// module.exports = {authenticateToken, authenticateToken}
module.exports = { authenticateToken };
