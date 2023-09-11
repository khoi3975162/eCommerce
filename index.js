// Import libraries
const express = require('express');
const cookieParser = require("cookie-parser");
const multer = require('multer');
const upload = multer({ dest: 'public/images/profiles/' });


require('./modules/database');
const User = require('./models/user');
const auth = require('./modules/auth');

// Create instances of the express application
const app = express();

// Middleware to parse POST data
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Use folder assets and views
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', auth, (req, res) => {
    if (req.guest) {
        return res.render('index', { user: "Guest", cart: 0 });
    }
    else {
        return res.render('index', { user: req.user.username, cart: 5 });
    }
})

app.get('/signup', auth, (req, res) => {
    if (req.guest) {
        return res.render('signup');
    }
    else {
        return res.status(403).send("You have already signed in, please sign out first.")
    }
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

        const user = await new User(userData);
        await user.save();
        const token = await user.generateAuthToken();
        return res
            .cookie("access_token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
            })
            .status(200)
            .redirect('/')
    } catch (error) {
        console.log(error);
    }
})

app.get('/signin', auth, (req, res) => {
    if (req.guest) {
        return res.render('signin');
    }
    else {
        return res.status(403).send("You have already signed in, please sign out first.")
    }
})

app.post('/signin', auth, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findByCredentials(username, password);
        if (!user) {
            return res.status(401).send('Login failed! Please check your credentials');
        }
        const token = await user.generateAuthToken();
        return res
            .cookie("access_token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
            })
            .status(200)
            .redirect('/');
    } catch (error) {
        console.log(error);
    }
})

app.get('/me', auth, (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else {
        return res.render('me', { user: req.user })
    }
})

app.get('/signout', auth, (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/');
    }
    else {
        try {
            req.user.tokens = req.user.tokens.filter((token) => {
                return token.token != req.token;
            })
            req.user.save();
            return res
                .clearCookie("access_token")
                .status(200)
                .redirect('/');
        } catch (error) {
            console.log(error);
        }
    }
})

app.get('/check/username/:username', async (req, res) => {
    const exist = await User.ifUserExist(req.params.username);
    if (exist) {
        return res.send('true');
    }
    else {
        return res.send('false');
    }
})

app.get('/check/vendorname/:vendorname', async (req, res) => {
    const exist = await User.ifVendorExist('vendor.vendorName', req.params.vendorname);
    if (exist) {
        return res.send('true');
    }
    else {
        return res.send('false');
    }
})

app.get('/check/vendoraddress/:vendoraddress', async (req, res) => {
    const exist = await User.ifVendorExist('vendor.vendorAddress', req.params.vendoraddress);
    if (exist) {
        return res.send('true');
    }
    else {
        return res.send('false');
    }
})

app.get('/cart', auth, (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else {
        return res.render('cart');
    }
})

app.get('/orders', auth, (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else {
        return res.render('orders');
    }
})


// Start the server and listen on port 3000
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000')
})
