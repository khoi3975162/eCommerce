const mongoose = require('mongoose');
const User = require('./User');
const Cart = require('./Cart');
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
        enum: ["Ho Chi Minh", "Hanoi", "Da Nang"]
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
        enum: ["Active", "Delivered", "Canceled"]
    }
})

function compareStatus(a, b) {
    if (a.status == "Active") {
        return -1;
    }
    else if (b.status == "Delivered") {
        return -1;
    }
    else if (b.status == "Canceled") {
        return 1;
    }
    return 0;
}

async function parseOrder(order) {
    var products = [];
    for (y = 0; y < order.products.length; y++) {
        products.push({
            product: await Product.findById(order.products[y].product),
            quantity: order.products[y].quantity
        })
    }

    var vendors = []
    for (y = 0; y < products.length; y++) {
        const vendor = await User.findById(products[y].product.owner);
        if (!vendors.some(_vendor => _vendor._id.toString() == vendor._id.toString())) {
            vendors.push(vendor);
        }
    }

    var groupedProducts = [];
    for (y = 0; y < vendors.length; y++) {
        var filteredProducts = [];
        products.forEach(function (product) {
            if (product.product.owner._id.toString() == vendors[y]._id.toString()) {
                filteredProducts.push(product)
            }
        })
        groupedProducts.push({
            id: vendors[y]._id.toString(),
            username: vendors[y].username,
            vendorName: vendors[y].vendor.vendorName,
            products: filteredProducts
        })
    }
    return groupedProducts;
}

async function parseOrders(orders) {
    var newOrders = [];
    for (i = 0; i < orders.length; i++) {
        const order = orders[i];

        const groupedProducts = await parseOrder(order);

        const owner = await User.findById(order.owner)
        newOrders.push({
            _id: order._id.toString(),
            username: owner.username,
            customerName: owner.customer.customerName,
            customerAddress: owner.customer.customerAddress,
            vendors: groupedProducts,
            hub: order.hub,
            totalPrice: order.totalPrice,
            status: order.status
        })
    }
    return newOrders.sort(compareStatus);
}

orderSchema.statics.getOrder = async (order) => {
    const owner = await User.findById(order.owner)
    return {
        _id: order._id.toString(),
        username: owner.username,
        customerName: owner.customer.customerName,
        customerAddress: owner.customer.customerAddress,
        vendors: await parseOrder(order),
        hub: order.hub,
        totalPrice: order.totalPrice,
        status: order.status
    }
}

orderSchema.statics.getOrdersfromUser = async (user) => {
    const orders = await Order.find({ owner: user });
    return parseOrders(orders);
}

orderSchema.statics.getOrdersfromHub = async (hub) => {
    const orders = await Order.find({ hub: hub, status: 'Active' });
    return parseOrders(orders);
}

orderSchema.statics.createOrder = async (user, _hub) => {
    const cart = await Cart.findOne({ owner: user });
    if (cart.products.length == 0) {
        return "Cart has no products";
    }
    var totalPrice = 0;
    for (i = 0; i < cart.products.length; i++) {
        const product = await Product.findById(cart.products[i].product)
        totalPrice = totalPrice + (product.price * cart.products[i].quantity)
    }

    const hubs = ["Ho Chi Minh", "Hanoi", "Da Nang"];
    var hub = null;
    if (_hub & hubs.includes(_hub)) {
        hub = _hub;
    }
    else {
        hub = hubs[Math.floor(Math.random() * hubs.length)]
    }
    const orderData = {
        owner: user,
        products: cart.products,
        hub: hub,
        totalPrice: totalPrice.toFixed(2),
        status: "Active"
    }
    const order = await new Order(orderData);
    await order.save();
    cart.products = [];
    await cart.save();
    return order;
}

// Define models based on the schema
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
