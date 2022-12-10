const fetch = require('node-fetch')
const url = 'http://localhost:3000/users'

const apis = {
    changePass: (email) => {
        fetch(url + '/changePass', {
            method: 'POST',
            headers: myHeaders,
        }).then(res => {
            res.render('changePass', {email: email})
        })
    }
}
module.exports = apis