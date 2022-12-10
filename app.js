var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');

var indexRouter = require('./routes/index');
var userAPI = require('./APIs/users')
var walletAPI = require('./APIs/walletAPI');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
var hbs = require('handlebars');
hbs.registerHelper('contains', function (value, options) {
    return parseInt(value) + 1;
});
app.use(session({ cookie: { maxAge: 60000 }, secret: 'group1', resave: false, saveUninitialized: false }));
app.use(require('flash')());
app.use(function (req, res, next) {
    res.locals.sessionFlash = req.session.sessionFlash;
    delete req.session.sessionFlash;
    next();
});

app.all('/session-flash', function (req, res) {
    req.session.sessionFlash = {
        type: 'success',
        message: 'This is a flash message using custom middleware and express-session.',
    };
    res.redirect(301, '/');
});

app.use(
    cors({
        origin: ['*'],
        methods: ['GET', 'PUT', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
        credentials: true,
        maxAge: 600,
        exposedHeaders: ['*', 'Authorization', 'x-csrf-token'],
    }),
);

// app.use(
//     cors({
//         origin: '[*]',
//         credentials: true,
//     }),
// );


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.CONNECTION_STRING);
const database = mongoose.connection;

database.on('error', (error) => {
    console.log(error);
});

database.once('connected', () => {
    console.log('MongoDB connected successfully!');
});

app.use('/', indexRouter);
app.use('/users/', userAPI)
app.use('/wallet/', walletAPI);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
