// Import libraries
const express = require('express');
const cookieParser = require("cookie-parser");
const multer = require('multer');
const fs = require('fs/promises');

const profile_upload = multer({ dest: 'public/images/profiles/' });
const product_upload = multer({ dest: 'public/images/products/temp' });

require('./modules/database');
const auth = require('./modules/auth');
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');
const { existsSync } = require('fs');

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
    return res.send("You have already signed in, please sign out first.")
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
            return resRedirect(res, token, '/dashboard');
        }
        else if (req.body['accounttype'] == 'customer') {
            return resRedirect(res, token, '/');
        }
        else if (req.body['accounttype'] == 'shipper') {
            return resRedirect(res, token, '/orders');
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
    return res.send("You have already signed in, please sign out first.")
})

/* The below code is a route handler for the "/signin" endpoint. It handles the user login
functionality. */
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
            return resRedirect(res, token, '/');
        }
        else if (accountType == 'shipper') {
            return resRedirect(res, token, '/orders');
        }
    } catch (error) {
        console.log(error);
    }
})

/* view my account page */
app.get('/me', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else {
        const data = await getData(req);
        var user = {
            username: req.user.username,
            profile: req.user.profile
        }
        if (data.accountType == "customer") {
            user[customerName] = req.user.customer.customerName;
            user[customerAddress] = req.user.customer.customerAddress;
        }
        else if (data.accountType == "vendor") {
            user[vendorName] = req.user.customer.vendorName;
            user[vendorAddress] = req.user.customer.vendorAddress;
        }
        else if (data.accountType == "shipper") {
            user[hub] = req.user.shipper.hub;
        }
        return res.render('me', {
            data: {
                ...data,
                user: user,
            }
        });
    }
})

/* about us page */
app.get('/about', auth, async (req, res) => {
    return res.render('aboutus', {
        data: await getData(req)
    })
})

/* The below code is defining a route handler for the "/signout" endpoint. It is using the "auth"
middleware to authenticate the request. */
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

/* view all products on the db, available for all user  */
app.get('/products', auth, async (req, res) => {
    return res.render('products', {
        data: {
            ...await getData(req),
            products: await Product.getProductsbyVendors()
        }
    })
})

/* view products of a vendor, available for all user */
app.get('/products/:vendorusername', auth, async (req, res) => {
    var isOwner = false;
    if (req.user.username == req.params.vendorusername) {
        isOwner = true;
    }
    return res.render('products', {
        data: {
            ...await getData(req),
            isOwner: isOwner,
            products: await Product.getProductsfromVendor(req.params.vendorusername)
        }
    })
})

/* add new product page for vendor only */
app.get('/dashboard', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/dashboard', { data: await getData(req) });
    }
    return res.send("The account you are logged in is not a vendor account.");
})

/* add new product page for vendor only */
app.get('/product/new', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        return res.render('vendor/create-product', { data: await getData(req) });
    }
    return res.send("The account you are logged in is not a vendor account.");
})

/* post endpoint for adding new product, for vendor only */
app.post('/product/new', product_upload.array('product-imgs', 4), auth, async (req, res) => {
    const vendor = await User.findOne({ _id: req.user._id, "vendor.accountType": true });
    if (vendor) {
        var images = [];
        for (i = 0; i < req.files.length; i++) {
            images.push(req.files[i]['filename'])
        }

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

/* specific product page, available for all user */
app.get('/product/:id', auth, async (req, res) => {
    try {
        const productData = await Product.findById(req.params.id);
        return res.render('product', {
            data: {
                ...await getData(req),
                product: productData.toObject()
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


/* update specific product page for vendor only */
app.get('/product/:id/update', auth, async (req, res) => {
    if (req.guest) {
        return resSignIn(res);
    }
    else if (await User.getAccountType(req.user) == 'vendor') {
        try {
            const productData = await Product.findById(req.params.id);
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

/* post endpoint for updating product */
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

/* post endpoint for deleting a product */
app.post('/product/:id/delete', auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product.owner._id.toString() == req.user._id.toString()) {
            await Product.findByIdAndDelete(req.params.id);
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


/* cart page for customer only */
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

/* add to cart for customer only */
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

/* update items in cart for customer only */
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

/* place order for customer only */
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

/* specific order page for customer and shipper only */
app.get('/order/:id', auth, async (req, res) => {
    const accountType = await User.getAccountType(req.user);
    if (req.guest) {
        return resSignIn(res);
    }
    else if (accountType == 'customer' || accountType == 'shipper') {
        try {
            var order = await Order.findById(req.params.id);
            var valid = false;
            if (accountType == 'customer' & order.owner.toString() == req.user._id.toString()) {
                valid = true;
            }
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

/* edit order status endpoint for shipper only */
app.post('/order/:id/status/:status', auth, async (req, res) => {
    const accountType = await User.getAccountType(req.user);
    if (req.guest) {
        return resSignIn(res);
    }
    else if (accountType == 'shipper') {
        try {
            const order = await Order.findById(req.params.id);
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

/* view all orders page for customer and shipper only */
app.get('/orders', auth, async (req, res) => {
    const accountType = await User.getAccountType(req.user);
    if (req.guest) {
        return resSignIn(res);
    }
    else if (accountType == 'customer' || accountType == 'shipper') {
        var orders = null;
        orders = await Order.getOrdersfromUser(req.user);
        var hub = "none";
        if (accountType == 'shipper') {
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

// app.listen(3000, ('0.0.0.0'