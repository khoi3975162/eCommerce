const mongoose = require('mongoose');
const User = require('./User');
const Product = require('./Product');

// Define schema
const cartSchema = mongoose.Schema({
    owner: {
        type: 'ObjectId',
        ref: 'User'
    },
    products: [{
        product: {
            type: 'ObjectId',
            ref: 'Product'
        },
        quantity: {
            type: Number,
            required: true,
            validate: {
                validator: Number.isInteger,
                message: '{VALUE} is not an integer value'
            }
        }
    }]
})

cartSchema.statics.createCart = async (user) => {
    // const owner = await User.findOne({ 'username': username });
    const data = {
        'owner': user,
        products: []
    }
    await new Cart(data).save();
}

cartSchema.statics.addToCart = async (username, product) => {
}

cartSchema.statics.updateCart = async (username, action, product, quantity) => {
}

// Define models based on the schema
const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
