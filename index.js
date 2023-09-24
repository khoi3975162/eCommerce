// RMIT University Vietnam
// Course: COSC2430 Web Programming
// Semester: 2023A
// Assessment: Assignment 2
// Author and ID: Le Nguyen Khoi(3975162), Nguyen Thanh Dat(3975867), Tran Anh Tuan(3974799), Le Chanh Tri(3924585)
// ID: Your student ids (e.g. 1234567)
// Acknowledgement: Acknowledge the resources that you use here.

// Import libraries
const express = require('express');
const cookieParser = require("cookie-parser");
const multer = require('multer');
const fs = require('fs/promises');
const auth = require('./modules/auth');
const { existsSync } = require('fs');
require('./modules/database');

// import mongoose models
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');

// multer image upload destination
const profile_upload = multer({ dest: 'public/images/profiles/' });
const product_upload = multer({ dest: 'public/images/products/temp' });

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
        }
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

/**
 * The function resRedirect sets a cookie, sends a 200 status code, and redirects the response to a
 * specified endpoint.
 * @param res - The `res` parameter is the response object that is passed to the function. It is used
 * to send the response back to the client.
 * @param endpoint - The `endpoint` parameter is the URL or path where you want to redirect the user
 * after setting the cookie and sending the response.
 * @returns the response object after setting a cookie and redirecting to the specified endpoint.
 */
function resRedirect(res, token, endpoint) {
    return res.cookie("access_token", token).redirect(endpoint);
}

/**
 * The function resSignIn redirects the user to the signin page with a status code of 401
 * (Unauthorized).
 * @param res - The "res" parameter is the response object that is passed to the function. It is used
 * to send a response back to the client.
 * @returns a response object with a status code of 401 and a redirect to the '/signin' route.
 */
function resSignIn(res) {
    return res.redirect('/signin');
}

// home route
app.get('/', auth, async (req, res) => {
    const products = await Product.find({});
    return res.render('index', {
        data: {
            ...await getData(req),
            products: products.sort(() => Math.random() - 0.5)
        }
    });
})

// signup get route
app.get('/signup', auth, (req, res) => {
    if (req.guest) {
        return res.render('signup');
    }
    return res.send("You have already signed in, please sign out first.")
})

// sign up post route
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
            return resRedirect(res, token, '/dashboard');
        }
        else if (req.body['accounttype'] == 'customer') {
            return resRedirect(res, token, '/products');
        }
        else if (req.body['accounttype'] == 'shipper') {
            return resRedirect(res, token, '/orders');
        }
    } catch (error) {
        console.log(error);
    }
})

// singin get route
app.get('/signin', auth, (req, res) => {
    if (req.guest) {
        return res.render('signin');
    }
    return res.send("You have already signed in, please sign out first.")
})

// signin post route
app.post('/signin', async (req, res) => {
    try {
        // find user then generate token for login session
        const { username, password } = req.body;
        const user = await User.findByCredentials(username, password);
        if (!user) {
            return res.send('Login failed! Please check your credentials');
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
            return resRedirect(res, token, '/dashboard');
        }
        else if (accountType == 'customer') {
            return resRedirect(res, token, '/products');
        }
        else if (accountType == 'shipper') {
            return resRedirect(res, token, '/orders');
        }
    } catch (error) {
        console.log(error);
    }
})

// signout route
app.get('/signout', auth, (req, res) => {
    if (req.guest) {
        return res.redirect('/');
    }
    else {
        try {
            // remove token from db then clear token on client
            req.user.tokens = req.user.tokens.filter((token) => {
                return token.token != req.token;
            })
            req.user.save();
            return res.clearCookie("access_token").redirect('/');
        } catch (error) {
            console.log(error);
        }
    }
})

// my account route
app.get('/me', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else {
        // parse user data based on account type
        const data = await getData(req);
        var user = {
            username: req.user.username,
            profile: req.user.profile
        }
        if (data.accountType == "customer") {
            user.customerName = req.user.customer.customerName;
            user.customerAddress = req.user.customer.customerAddress;
        }
        else if (data.accountType == "vendor") {
            user.vendorName = req.user.vendor.vendorName;
            user.vendorAddress = req.user.vendor.vendorAddress;
        }
        else if (data.accountType == "shipper") {
            user.hub = req.user.shipper.hub;
        }
        return res.render('me', {
            data: {
                ...data,
                user: user,
            }
        });
    }
})

// update profile image route
app.post('/me/update', profile_upload.single('profile'), auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else {
        if (req.user.profile != 'default.jpg') {
            await fs.rm('./public/images/profiles/' + req.user.profile, { recursive: true, force: true });
        }
        req.user.profile = req.file['filename'];
        await User.findByIdAndUpdate(req.user._id, req.user, {
            new: true,
            runValidators: true,
        })
        return res.redirect('back');
    }
})

// remove profile image route
app.post('/me/remove', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else {
        if (req.user.profile != 'default.jpg') {
            await fs.rm('./public/images/profiles/' + req.user.profile, { recursive: true, force: true });
            req.user.profile = 'default.jpg';
            await User.findByIdAndUpdate(req.user._id, req.user, {
                new: true,
                runValidators: true,
            })
        }
        return res.redirect('back');
    }
})

// view all products on the db, available for all users
app.get('/products', auth, async (req, res) => {
    return res.render('products', {
        data: {
            ...await getData(req),
            products: await Product.getProductsbyVendors(),
            all: false
        }
    })
})

// view products of a vendor, available for all users
app.get('/products/vendor/:vendorusername', auth, async (req, res) => {
    var isOwner = false;
    if (req.user.username == req.params.vendorusername) {
        isOwner = true;
    }
    return res.render('products', {
        data: {
            ...await getData(req),
            isOwner: isOwner,
            products: await Product.getProductsfromVendor(req.params.vendorusername),
            all: true
        }
    })
})

// view price filtered products
app.post('/products/filter', auth, async (req, res) => {
    return res.render('products', {
        data: {
            ...await getData(req),
            products: await Product.getFilteredProducts(req.body['min-price'], req.body['max-price']),
            all: true
        }
    })
})

// view searched products
app.post('/products/search', auth, async (req, res) => {
    return res.render('products', {
        data: {
            ...await getData(req),
            products: await Product.getSearchProducts(req.body['search']),
            all: true
        }
    })
})

// dashboard page for vendor only
app.get('/dashboard', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/dashboard', { data: await getData(req) });
    }
    return res.send("The account you are logged in is not a vendor account.");
})

// add new product page for vendor only
app.get('/product/new', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/create-product', { data: await getData(req) });
    }
    return res.send("The account you are logged in is not a vendor account.");
})

// add new product post route for vendor only
app.post('/product/new', product_upload.array('product-imgs', 4), auth, async (req, res) => {
    const vendor = await User.findOne({ _id: req.user._id, "vendor.accountType": true });
    if (vendor) {
        // parse images names from request
        var images = [];
        for (i = 0; i < req.files.length; i++) {
            images.push(req.files[i]['filename'])
        }

        // create new product
        const productData = {
            owner: vendor,
            name: req.body['product-name'],
            price: req.body['product-price'],
            images: images,
            description: req.body['product-desciption']
        }
        const product = await new Product(productData);

        // create new dir for the vendor
        if (!existsSync('./public/images/products/' + vendor._id)) {
            await fs.mkdir('./public/images/products/' + vendor._id, { recursive: true });
        }
        // rename temp folder contains the uploaded imgs to product id and place it inside vendor dir
        await fs.rename('./public/images/products/temp', './public/images/products/' + vendor._id + '/' + product._id);
        // recreate temp dir
        await fs.mkdir('./public/images/products/temp', { recursive: true });

        await product.save();
        return res.redirect('/product/' + product._id);
    }
    else {
        // remove temp dir that contains uploaded img and recreate it
        await fs.rm('./public/images/products/temp', { recursive: true, force: true });
        await fs.mkdir('./public/images/products/temp', { recursive: true });

        return res.send("The account you are logged in is not a vendor account.");
    }
})

// view specific product, available for all users
app.get('/product/:id', auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const vendor = await User.findById(product.owner);
        return res.render('product', {
            data: {
                ...await getData(req),
                product: product.toObject(),
                vendor: {
                    username: vendor.username,
                    name: vendor.vendor.vendorName,
                    profile: vendor.profile,
                },
                products: await Product.getProductsfromVendor(vendor.username, true)
            }
        });
    }
    catch (error) {
        if (error.name == "CastError") {
            return res.send("The product is not exist.");
        }
        console.log(error);
    }
})


// update specific product page for vendor only
app.get('/product/:id/update', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        try {
            const productData = await Product.findById(req.params.id);

            // check if the current product owner is the same of the requesting vendor
            if (productData.owner._id.toString() == req.user._id.toString()) {
                return res.render('vendor/update-product', {
                    data: {
                        ...await getData(req),
                        product: productData.toObject()
                    }
                });
            }
            return res.send("You are not the owner of this product.");
        }
        catch (error) {
            if (error.name == "CastError") {
                return res.send("The product is not exist.");
            }
            console.log(error);
        }
    }
    return res.send("The account you are logged in is not a vendor account.");
})

// product update post route
app.post('/product/:id/update', product_upload.array('product-imgs', 4), auth, async (req, res) => {
    const productData = await Product.findById(req.params.id);
    if (productData.owner._id.toString() == req.user._id.toString()) {
        const productData = {
            name: req.body['product-name'],
            price: req.body['product-price'],
            description: req.body['product-desciption']
        }

        // check if images being edited
        if (req.files.length > 0) {
            // parse images names from request
            var images = [];
            for (i = 0; i < req.files.length; i++) {
                images.push(req.files[i]['filename'])
            }
            productData.images = images;

            // remove old products images folder
            await fs.rm('./public/images/products/' + req.user._id + '/' + req.params.id, { recursive: true, force: true });
            // rename temp folder contains the uploaded imgs to product id and place it inside vendor folder
            await fs.rename('./public/images/products/temp', './public/images/products/' + req.user._id + '/' + req.params.id);
            // recreate temp folder
            await fs.mkdir('./public/images/products/temp', { recursive: true });
        }

        // update product in db
        await Product.findByIdAndUpdate(req.params.id, productData, {
            new: true,
            runValidators: true,
        })
        return res.redirect('/product/' + req.params.id);
    }
    else {
        // remove temp dir that contains uploaded img and recreate it
        await fs.rm('./public/images/products/temp', { recursive: true, force: true });
        await fs.mkdir('./public/images/products/temp', { recursive: true });

        return res.send("You are not the owner of this product.");
    }
})

// product delete route
app.post('/product/:id/delete', auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        // check if the current product owner is the same of the requesting vendor
        if (product.owner._id.toString() == req.user._id.toString()) {
            // delete product from db
            await Product.findByIdAndDelete(req.params.id);
            // delete product images from local
            await fs.rm('./public/images/products/' + req.user._id + '/' + req.params.id, { recursive: true, force: true });
            return res.redirect('/products/' + req.user._id);
        }
        else {
            return res.send("You are not the owner of this product.");
        }
    }
    catch (error) {
        if (error.name == "CastError") {
            return res.send("The product is not exist.");
        }
        console.log(error);
    }
})


// cart page for customer only
app.get('/cart', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'customer') {
        return res.render('customer/cart', {
            data: {
                ...await getData(req),
                cart: await Cart.getCartbyVendor(req.user)
            }
        });
    }
    return res.send("The account you are logged in is not a customer account.");
})

// add to cart post route for customer only
app.post('/cart/add/:productid/quantity/:quantity', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'customer') {
        await Cart.addToCart(req.user, req.params.productid, req.params.quantity);
        return res.redirect('back');
    }
    return res.send("The account you are logged in is not a customer account.");
})

// remove an item/quantity in cart route for customer only
app.post('/cart/remove/:productid/quantity/:quantity', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'customer') {
        await Cart.removeFromCart(req.user, req.params.productid, req.params.quantity);
        return res.redirect('back');
    }
    return res.send("The account you are logged in is not a customer account.");
})

// place order post route for customer only
app.post('/order', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'customer') {
        const order = await Order.createOrder(req.user, req.body['hub']);
        return res.redirect('/order/' + order._id);
    }
    return res.send("The account you are logged in is not a customer account.");
})

// view specific order for customer and shipper
app.get('/order/:id', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'customer' || await User.getAccountType(req.user) == 'shipper') {
        try {
            const accountType = await Order.getAccountType(req.user);
            var order = await Order.findById(req.params.id);
            var valid = false;
            // check if the requested order's owner is the same with the requesting customer
            if (accountType == 'customer' & order.owner.toString() == req.user._id.toString()) {
                valid = true;
            }
            // check if the requested order's hub is the same with the requesting shipper hub
            else if (accountType == 'shipper' & order.hub == req.user.shipper.hub) {
                valid = true;
            }

            if (valid) {
                return res.render('order', {
                    data: {
                        ...await getData(req),
                        order: await Order.getOrder(order)
                    }
                });
            }
            return res.send("You are not authorized to view to view this order.")
        }
        catch (error) {
            if (error.name == "CastError") {
                return res.send("The order is not exist.");
            }
            console.log(error);
        }
    }
    return res.send("The account you are logged in is not a customer or shipper account.");
})

// edit status post route for shipper only
app.post('/order/:id/status/:status', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'shipper') {
        try {
            const order = await Order.findById(req.params.id);
            // check if the requested order's hub is the same with the requesting shipper hub
            if (order.hub == req.user.shipper.hub) {
                if (["Delivered", "Canceled"].includes(req.params.status)) {
                    order.status = req.params.status;
                }
                await order.save();
                return res.redirect('back');
            }
            return res.send("You are not authorized to view to view this order.");
        }
        catch (error) {
            if (error.name == "CastError") {
                return res.send("The order is not exist.");
            }
            console.log(error);
        }
    }
    return res.send("The account you are logged in is not a shipper account.");
})

// view all products from customer or hub for customer and shipper
app.get('/orders', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'customer' || await User.getAccountType(req.user) == 'shipper') {
        const accountType = await User.getAccountType(req.user);
        var orders = null;
        var hub = "none";
        // get order from user requested user is customer
        if (accountType == 'customer') {
            orders = await Order.getOrdersfromUser(req.user);
        }
        // get order from hub requested user is shipper
        else if (accountType == 'shipper') {
            hub = req.user.shipper.hub;
            orders = await Order.getOrdersfromHub(hub);
        }
        return res.render('orders', {
            data: {
                ...await getData(req),
                orders: orders,
                hub: hub
            }
        })
    }
    return res.send("The account you are logged in is not a customer or shipper account.");
})

// about us page route
app.get('/about', auth, async (req, res) => {
    return res.render('about', {
        data: await getData(req)
    })
})

// privacy page route
app.get('/privacy', auth, async (req, res) => {
    return res.render('privacy', {
        data: await getData(req)
    })
})

// terms page route
app.get('/terms', auth, async (req, res) => {
    return res.render('terms', {
        data: await getData(req)
    })
})

// for checking if username is already exist in database during sign up
app.get('/check/username/:username', async (req, res) => {
    const exist = await User.ifUserExist(req.params.username);
    if (exist) {
        return res.send('true');
    }
    else {
        return res.send('false');
    }
})

// for checking if vendor name is already exist in database during sign up
app.get('/check/vendorname/:vendorname', async (req, res) => {
    const exist = await User.ifVendorExist('vendor.vendorName', req.params.vendorname);
    if (exist) {
        return res.send('true');
    }
    return res.send('false');
})

// for checking if vendor address is already exist in database during sign up
app.get('/check/vendoraddress/:vendoraddress', async (req, res) => {
    const exist = await User.ifVendorExist('vendor.vendorAddress', req.params.vendoraddress);
    if (exist) {
        return res.send('true');
    }
    return res.send('false');
})

// check if credentials exist in the database during sign in
app.post('/check/signin', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findByCredentials(username, password);
    if (user) {
        return res.send('true');
    }
    return res.send('false');
})

// Start the server and listen on port 3000
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000')
})

