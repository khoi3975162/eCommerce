// Import libraries
const express = require('express');
const cookieParser = require("cookie-parser");
const multer = require('multer');
const upload = multer({ dest: 'public/images/profiles/' });


require('./modules/database');
const User = require('./models/User');
const Cart = require('./models/Cart');
const auth = require('./modules/auth');

// Create instances of the express application
const app = express();

// Middleware to parse POST data
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Use folder assets and views
app.use(express.static('public'));
app.set('view engine', 'ejs');

async function getData(req) {
    if (req.guest) {
        return {
            accountType: "none",
            username: "Guest",
            cartCount: 0
        };
    }
    else {
        const cart = await Cart.findOne({ 'owner': req.user });
        return {
            accountType: await User.getAccountType(req.user),
            username: req.user.username,
            cartCount: cart['products'].length
        }
    }
}

app.get('/', auth, async (req, res) => {
    return res.render('index', { data: await getData(req) });
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
        // parse userData
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

        // create new user and their cart in db then generate token for login session
        const user = await new User(userData);
        await user.save();
        await Cart.createCart(user);
        const token = await user.generateAuthToken();

        // save token in cookie on client redirect user based on account type
        if (req.body['accounttype'] == 'vendor') {
            return res
                .cookie("access_token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                })
                .status(200)
                .redirect('/dashboard');
        }
        else if (req.body['accounttype'] == 'customer') {
            return res
                .cookie("access_token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                })
                .status(200)
                .redirect('/');
        }
        else if (req.body['accounttype'] == 'shipper') {
            return res
                .cookie("access_token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                })
                .status(200)
                .redirect('/orders');
        }
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

app.post('/signin', async (req, res) => {
    try {
        // find user then generate token for login session
        const { username, password } = req.body;
        const user = await User.findByCredentials(username, password);
        if (!user) {
            return res.status(401).send('Login failed! Please check your credentials');
        }
        const token = await user.generateAuthToken();

        // create cart for user if not exists by somehow
        const cart = await Cart.findOne({ 'owner': user });
        if (!cart) {
            await Cart.createCart(user);
        }

        // save token in cookie on client redirect user based on account type
        const accountType = await User.getAccountType(user);
        if (accountType == 'vendor') {
            return res
                .cookie("access_token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                })
                .status(200)
                .redirect('/dashboard');
        }
        else if (accountType == 'customer') {
            return res
                .cookie("access_token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                })
                .status(200)
                .redirect('/');
        }
        else if (accountType == 'shipper') {
            return res
                .cookie("access_token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                })
                .status(200)
                .redirect('/orders');
        }
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
        return res.render('me', { user: req.user });
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
            // remove token from db then clear token on client
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

/* products viewport for vendor only */
app.get('/products', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/products');
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a vendor account.");
    }
})

/* view products of a vendor, available for all user */
app.get('/products/:vendorname', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else {
        return res.render('products');
    }
})

/* add new product page for vendor only */
app.get('/product/new', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/create-product', { data: await getData(req) });
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a vendor account.");
    }
})

app.post('/product/new', auth, async (req, res) => {
    try {

    }
    catch (error) {
        console.log(error);
    }
})

/* specific product page, available for all user */
app.get('/product/:id', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else {
        return res.render('product');
    }
})


/* update specific product page for vendor only */
app.get('/product/:id/update', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/update-product');
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a vendor account.");
    }
})

app.post('/product/:id/update', auth, async (req, res) => {
    try {

    }
    catch (error) {
        console.log(error);
    }
})


/* delete specific product page for vendor only */
app.get('/product/:id/delete', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/delete-product');
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a vendor account.");
    }
})

app.post('/product/:id/delete', auth, async (req, res) => {
    try {

    }
    catch (error) {
        console.log(error);
    }
})


/* cart page for customer only */
app.get('/cart', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (await User.getAccountType(req.user) == 'customer') {
        return res.render('customer/cart');
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a customer account.");
    }
})

/* orders page for customer and shipper only */
app.get('/orders', auth, async (req, res) => {
    const accountType = await User.getAccountType(req.user);
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (accountType == 'customer') {
        return res.render('customer/orders');
    }
    else if (accountType == 'shipper') {
        return res.render('shipper/orders');
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a customer or shipper account.");
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

app.post('/check/signin', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findByCredentials(username, password);
    if (user) {
        return res.send('true');
    }
    else {
        return res.send('false');
    }
})

// Start the server and listen on port 3000
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000')
})

// app.listen(3000, ('0.0.0.0'))