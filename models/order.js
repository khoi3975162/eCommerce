const mongoose = require('mongoose');
const User = require('./User');
const Product = require('./Product');

// Define schema
const orderSchema = mongoose.Schema({
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
    }],
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        required: true,
        maxLength: 9
    }
})

// Define models based on the schema
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
