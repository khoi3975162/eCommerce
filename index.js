// Import libraries
const express = require('express');
const cookieParser = require("cookie-parser");
const multer = require('multer');
const profile_upload = multer({ dest: 'public/images/profiles/' });
const product_upload = multer({ dest: 'public/images/products/' });

require('./modules/database');
const auth = require('./modules/auth');
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');

// Create instances of the express application
const app = express();

// Middleware to parse POST data
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Use folder assets and views
app.use(express.static('public'));
app.set('view engine', 'ejs');

/**
 * The function `getData` returns an object with account information based on the request, including
 * account type, username, and cart count.
 * @param req - The `req` parameter is an object that represents the request made to the server. It
 * typically contains information about the user making the request, such as their authentication
 * status and user details.
 * @returns an object with the properties `accountType`, `username`, and `cartCount`. If `req.guest` is
 * true, the `accountType` will be set to "none", `username` will be set to "Guest", and `cartCount`
 * will be set to 0. If `req.guest` is false, the `accountType` will be
 */
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

/* The below code is defining a route handler for the root URL ("/") using the Express.js framework. It
is using the `app.get()` method to handle GET requests to the root URL. The `auth` middleware
function is being used to authenticate the request before executing the route handler. */
app.get('/', auth, async (req, res) => {
    return res.render('index', { data: await getData(req) });
})

/* The below code is defining a route for the "/signup" endpoint. It uses the "auth" middleware to
check if the user is a guest or not. If the user is a guest, it renders the "signup" view. If the
user is not a guest (i.e., already signed in), it sends a 403 Forbidden status code with a message
indicating that the user needs to sign out first. */
app.get('/signup', auth, (req, res) => {
    if (req.guest) {
        return res.render('signup');
    }
    else {
        return res.status(403).send("You have already signed in, please sign out first.")
    }
})

/* The below code is handling a POST request to the '/signup' endpoint. It is used for user
registration and account creation. */
app.post('/signup', profile_upload.single('profile'), async (req, res, next) => {
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

/* The below code is defining a route for the "/signin" endpoint. It uses the "auth" middleware
function to check if the user is a guest or not. If the user is a guest, it renders the "signin"
view. If the user is not a guest (i.e., already signed in), it sends a 403 Forbidden status code
with the message "You have already signed in, please sign out first." */
app.get('/signin', auth, (req, res) => {
    if (req.guest) {
        return res.render('signin');
    }
    else {
        return res.status(403).send("You have already signed in, please sign out first.")
    }
})

/* The below code is a route handler for the "/signin" endpoint. It handles the user login
functionality. */
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

app.get('/me', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else {
        const data = await getData(req);
        var user = null;
        if (data.accountType == "customer") {
            user = {
                username: req.user.username,
                profile: req.user.profile,
                customerName: req.user.customer.customerName,
                customerAddress: req.user.customer.customerAddress
            }
        }
        else if (data.accountType == "vendor") {
            user = {
                username: req.user.username,
                profile: req.user.profile,
                vendorName: req.user.customer.vendorName,
                vendorAddress: req.user.customer.vendorAddress
            }
        }
        else if (data.accountType == "shipper") {
            user = {
                username: req.user.username,
                profile: req.user.profile,
                hub: req.user.shipper.hub
            }
        }
        return res.render('me', { 
            data:  {
                ...data,
                user: user,
            }
        });
    }
})

/* The below code is defining a route handler for the "/signout" endpoint. It is using the "auth"
middleware to authenticate the request. */
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
        return res.render('products', { data: await getData(req) });
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
app.get('/dashboard', auth, async (req, res) => {
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/dashboard', { data: await getData(req) });
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a vendor account.");
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

app.post('/product/new', product_upload.array('product-imgs', 4), auth, async (req, res) => {
    const owner = await Product.getVendor(req.user);
    var images = [];
    for (i = 0; i < req.files.length; i++) {
        images.push(req.files[i]['filename'])
    }
    if (owner) {
        try {
            const productData = {
                owner: owner,
                name: req.body['product-name'],
                price: req.body['product-price'],
                images: images,
                description: req.body['product-desciption']
            }
            const product = await new Product(productData).save();
            return res.redirect('/product/' + product._id);
        }
        catch (error) {
            console.log(error);
        }
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a vendor account.");
    }
})

/* specific product page, available for all user */
app.get('/product/:id', auth, async (req, res) => {
    const productData = await Product.getProduct(req.params.id);
    if (productData) {
        return res.render('product', {
            data: {
                ...await getData(req),
                product: productData.toObject()
            }
        });
    }
    else {
        return res
            .status(404)
            .send("The product is not exist.");
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

/* specific order page for customer and shipper only */
app.get('/order/:id', auth, async (req, res) => {
    const accountType = await User.getAccountType(req.user);
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (accountType == 'customer' || accountType == 'shipper') {
        const order = await Order.getOrder(req.params.id);
        if (order) {
            return res.render('order', {
                data: {
                    ...await getData(req),
                    order: order,
                    accountType: accountType,
                }
            });
        }
        else {
            return res.status(404).send("There is no order with the id " + req.params.id + ".")
        }
    }
    else {
        return res
            .status(403)
            .send("The account you are logged in is not a customer or shipper account.");
    }
})

/* view all orders page for customer and shipper only */
app.get('/orders', auth, async (req, res) => {
    const accountType = await User.getAccountType(req.user);
    if (req.guest) {
        return res
            .status(401)
            .redirect('/signin');
    }
    else if (accountType == 'customer' || accountType == 'shipper') {
        const orders = await Order.getOrdersfromCustomer(req.user);
        var hub = "none";
        if (accountType == 'shipper') {
            hub = req.user.shipper.hub;
        }
        return res.render('orders', {
            data: {
                ...await getData(req),
                orders: orders,
                accountType: accountType,
                hub: hub
            }
        });
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