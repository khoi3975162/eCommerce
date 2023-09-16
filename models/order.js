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
        trim: true
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        required: true,
        maxLength: 9,
        trim: true
    }
})

orderSchema.statics.getOrdersfromCustomer = async (user) => {
    return await Order.find({ owner: user });
}

orderSchema.statics.getOrdersfromHub = async (hub) => {
    return await Order.find({ hub: hub, status: 'Active' });
}

orderSchema.statics.getOrder = async (id) => {
    try {
        return await Order.findOne({ _id: id });
    }
    catch (error) {
        if (error.name == "CastError") {
            return false;
        }
        else {
            console.log(error)
        }
    }
}


// Define models based on the schema
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
