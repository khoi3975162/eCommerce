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
    hub: {
        type: String,
        required: true,
    },
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

orderSchema.statics.getOrdersfromCustomer = async (user) => {
    return await Order.find({ owner: user });
}

orderSchema.statics.getOrdersfromHub = async (hub) => {
    return await Order.find({ hub: hub, status: 'Active' });
}

// Define models based on the schema
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
