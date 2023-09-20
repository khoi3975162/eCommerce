const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * The `auth` function is a middleware that checks if a user is authenticated by verifying their access
 * token, and sets the `req.user` and `req.token` properties if the token is valid.
 * @param req - The `req` parameter is an object that represents the HTTP request made by the client.
 * It contains information about the request such as the request headers, request body, request
 * parameters, cookies, etc. In this code snippet, `req` is used to access the `access_token` cookie
 * value.
 * @param res - The `res` parameter is the response object in Express.js. It represents the HTTP
 * response that the server sends back to the client. It is used to send data, set headers, and control
 * the response behavior.
 * @param next - The `next` parameter is a callback function that is used to pass control to the next
 * middleware function in the request-response cycle. It is typically called at the end of the current
 * middleware function to indicate that it has completed its processing and the next middleware
 * function should be called.
 * @returns In this code, if there is no token in the request cookies, the function sets the
 * `req.guest` property to `true` and calls the `next()` function to move to the next middleware or
 * route handler.
 */
const auth = async (req, res, next) => {
    const token = req.cookies.access_token;
    if (!token) {
        // no user was logged in, set account to guest
        req.guest = true;
        return next();
    }
    try {
        // find user with token
        const data = jwt.verify(token, "1convitxoera2caicanh");
        const user = await User.findOne({ _id: data._id, 'tokens.token': token });
        if (!user) {
            throw new Error({ 'error': "Invalid token, clearing client's cookies" });
        }
        req.user = user;
        req.token = token;
        req.guest = false;
        return next();
    } catch (error) {
        // clear client cookies if no token was found on db
        return res
            .clearCookie("access_token")
            .status(401)
            .redirect('/');
    }
}

module.exports = auth;
