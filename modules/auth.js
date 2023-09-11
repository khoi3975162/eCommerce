const jwt = require('jsonwebtoken');
const User = require('../models/user');

const auth = async (req, res, next) => {
    const token = req.cookies.access_token;
    if (!token) {
        req.guest = true;
        return next();
    }
    try {
        const data = jwt.verify(token, "1convitxoera2caicanh");
        const user = await User.findOne({ _id: data._id, 'tokens.token': token });
        if (!user) {
            throw new Error();
        }
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        return res
            .clearCookie("access_token")
            .status(401)
            .redirect('/');
    }

}

module.exports = auth
