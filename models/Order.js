// RMIT University Vietnam
// Course: COSC2430 Web Programming
// Semester: 2023A
// Assessment: Assignment 2
// Author and ID: Le Nguyen Khoi(3975162), Nguyen Thanh Dat(3975867), Tran Anh Tuan(3974799), Le Chanh Tri(3924585)
// ID: Your student ids (e.g. 1234567)
// Acknowledgement: Acknowledge the resources that you use here.

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

/**
 * The function compares the status of two objects and returns -1 if the first object's status is
 * "Active" or the second object's status is "Delivered", returns 1 if the second object's status is
 * "Canceled", and returns 0 otherwise.
 * @param a - The first parameter, `a`, is an object that represents a status. It has a property called
 * `status` which holds a string value indicating the status of something.
 * @param b - The parameter "b" is an object that represents a status.
 * @returns -1 if the status of object a is "Active" or the status of object b is "Delivered". It is
 * returning 1 if the status of object b is "Canceled". Otherwise, it is returning 0.
 */
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

/**
 * The function `parseOrder` takes an order object and returns an array of grouped products based on
 * the vendors.
 * @param order - The `order` parameter is an object that represents an order. It contains information
 * about the products in the order, such as the product ID and quantity.
 * @returns The function `parseOrder` returns an array of grouped products. Each grouped product object
 * contains the vendor's ID, username, vendor name, and an array of products associated with that
 * vendor.
 */
async function parseOrder(order) {
    // parse product objects from order
    var products = [];
    for (y = 0; y < order.products.length; y++) {
        products.push({
            product: await Product.findById(order.products[y].product),
            quantity: order.products[y].quantity
        })
    }

    // parse vendor objects from products
    var vendors = []
    for (y = 0; y < products.length; y++) {
        const product = products[y].product;
        if (product) {
            const vendor = await User.findById(product.owner);
            if (!vendors.some(_vendor => _vendor._id.toString() == vendor._id.toString())) {
                vendors.push(vendor);
            }
        }
    }

    // group products by vendors
    var groupedProducts = [];
    for (y = 0; y < vendors.length; y++) {
        var filteredProducts = [];
        products.forEach(function (product) {
            if (product.product) {
                if (product.product.owner._id.toString() == vendors[y]._id.toString()) {
                    filteredProducts.push(product);
                }
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

/**
 * The function `parseOrders` takes an array of orders, retrieves additional information for each
 * order, and returns a new array of orders with the retrieved information.
 * @param orders - The `orders` parameter is an array of objects representing orders. Each order object
 * has the following properties:
 * @returns The function `parseOrders` returns an array of new orders.
 */
async function parseOrders(orders) {
    var newOrders = [];
    for (i = 0; i < orders.length; i++) {
        const order = orders[i];
        const groupedProducts = await parseOrder(order);
        const owner = await User.findById(order.owner);
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

/* The `orderSchema.statics.getOrder` function is a static method defined on the `orderSchema` object.
It is used to retrieve detailed information about a specific order. */
orderSchema.statics.getOrder = async (order) => {
    const owner = await User.findById(order.owner);
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

/* The `orderSchema.statics.getOrdersfromUser` function is a static method defined on the `orderSchema`
object. It is used to retrieve all orders associated with a specific user. */
orderSchema.statics.getOrdersfromUser = async (user) => {
    const orders = await Order.find({ owner: user });
    return parseOrders(orders);
}

/* The `orderSchema.statics.getOrdersfromHub` function is a static method defined on the `orderSchema`
object. It is used to retrieve all orders that have a specific hub and an "Active" status. */
orderSchema.statics.getOrdersfromHub = async (hub) => {
    const orders = await Order.find({ hub: hub, status: 'Active' });
    return parseOrders(orders);
}

/* The `orderSchema.statics.createOrder` function is a static method defined on the `orderSchema`
object. It is used to create a new order based on the user's cart and save it to the database. */
orderSchema.statics.createOrder = async (user, _hub) => {
    const cart = await Cart.findOne({ owner: user });
    if (cart.products.length == 0) {
        return "Cart has no products";
    }

    // calculate total price for order
    var totalPrice = 0;
    for (i = 0; i < cart.products.length; i++) {
        const product = await Product.findById(cart.products[i].product);
        totalPrice = totalPrice + (product.price * cart.products[i].quantity);
    }

    // pass hub if exist, if not then random
    const hubs = ["Ho Chi Minh", "Hanoi", "Da Nang"];
    var hub = null;
    if (hubs.includes(_hub)) {
        hub = _hub;
    }
    else {
        hub = hubs[Math.floor(Math.random() * hubs.length)];
    }

    // save new order to db
    const orderData = {
        owner: user,
        products: cart.products,
        hub: hub,
        totalPrice: totalPrice.toFixed(2),
        status: "Active"
    }
    const order = await new Order(orderData);
    await order.save();

    // empty products from cart
    cart.products = [];
    await cart.save();

    return order;
}

// Define models based on the schema
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
