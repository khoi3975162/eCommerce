// Import libraries
const express = require('express')
const cookieParser = require("cookie-parser")
const multer = require('multer')
const upload = multer({ dest: 'public/images/profiles/' })


require('./modules/database')
const User = require('./models/user')
const auth = require('./modules/auth')

// Create instances of the express application
const app = express()

// Middleware to parse POST data
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Use folder assets and views
app.use(express.static('public'))
app.set('view engine', 'ejs')

app.get('/', auth, (req, res) => {
    if (req.guest == true) {
        res.render('index', { user: "Guest", cart: 0 })
    }
    else {
        res.render('index', { user: req.user.username, cart: 5 })
    }
})

app.get('/signup', (req, res) => {
    res.render('signup')
})

app.post('/signup', upload.single('profile'), async (req, res, next) => {
    try {
        var userData = {
            username: req.body['username'],
            password: req.body['password'],
        }

        if (req.file) {
            userData['profile'] = req.file['filename']
        }
        else {
            userData['profile'] = 'default.jpg'
        }

        if (req.body['accounttype'] == 'vendor') {
            userData['vendor'] = {}
            userData['vendor']['accountType'] = true
            userData['vendor']['vendorName'] = req.body['vendorname']
            userData['vendor']['vendorAddress'] = req.body['vendoraddress']
        }
        if (req.body['accounttype'] == 'customer') {
            userData['customer'] = {}
            userData['customer']['accountType'] = true
            userData['customer']['customerName'] = req.body['name']
            userData['customer']['customerAddress'] = req.body['address']
        }
        if (req.body['accounttype'] == 'shipper') {
            userData['shipper'] = {}
            userData['shipper']['accountType'] = true
            userData['shipper']['hub'] = req.body['hub']
        }

        const user = new User(userData)
        await user.save()
        const token = await user.generateAuthToken()
        return res
            .cookie("access_token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
            })
            .status(200)
            .redirect('/')
    } catch (error) {
        res.render('signup')
    }
})

app.get('/signin', (req, res) => {
    res.render('signin')
})

app.post('/signin', async (req, res) => {
    try {
        const { username, password } = req.body
        const user = await User.findByCredentials(username, password)
        if (!user) {
            return res.status(401).send({ error: 'Login failed! Check authentication credentials' })
        }
        const token = await user.generateAuthToken()
        return res
            .cookie("access_token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
            })
            .status(200)
            .redirect('/')
    } catch (error) {
        res.render('signin')
    }
})

app.get('/me', (req, res) => {
    res.render('me', { user: req.user })
})

app.post('/signout', auth, async (req, res) => {
    // Log user out of the application
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token != req.token
        })
        await req.user.save()
        return res
            .clearCookie("access_token")
            .status(200)
            .redirect('/')
    } catch (error) {
        return res.status(500).send(error)
    }
})

app.get('/usernamecheck/:username', async (req, res) => {
    User.find({ username: req.params.username })
        .then((usernames) => {
            if (usernames.length != 0) {
                res.send('true')
            }
            else {
                res.send('false')
            }
        })
        .catch((error) => console.log(error));
})

app.get('/vendornamecheck/:vendorname', async (req, res) => {
    User.find({ vendor: req.params.vendorname })
        .then((vendorname) => {
            if (vendorname.length != 0) {
                res.send('true')
            }
            else {
                res.send('false')
            }
        })
        .catch((error) => console.log(error));
})

app.get('/cart', (req, res) => {
    res.render('cart')
})

app.get('/orders', (req, res) => {
    res.render('orders')
})


// Start the server and listen on port 3000
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000')
})
