// RMIT University Vietnam
// Course: COSC2430 Web Programming
// Semester: 2023A
// Assessment: Assignment 2
// Author and ID: Le Nguyen Khoi(3975162), Nguyen Thanh Dat(3975867), Tran Anh Tuan(3974799), Le Chanh Tri(3924585)
// ID: Your student ids (e.g. 1234567)
// Acknowledgement: Acknowledge the resources that you use here.

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

/* The `cartSchema.statics.createCart` function is a static method defined on the `cartSchema` object.
It is used to create a new cart for a user. */
cartSchema.statics.createCart = async (user) => {
    const data = {
        owner: user,
        products: []
    }
    await new Cart(data).save();
}

cartSchema.statics.addToCart = async (user, productid, quantity) => {
    const product = await Product.findById(productid);
    var cart = await Cart.findOne({ owner: user });
    if (cart.products.some(_product => _product.product._id.toString() == product._id.toString())) {
        var cartProduct = cart.products.find((_product) => _product.product._id.toString() == product._id.toString());
        cartProduct.quantity = parseInt(cartProduct.quantity) + parseInt(quantity);
    }
    else {
        cart.products = cart.products.concat({
            product: product,
            quantity: quantity
        })
    }
    await cart.save();
}

cartSchema.statics.removeFromCart = async (user, productid, quantity) => {
    const product = await Product.findById(productid);
    var cart = await Cart.findOne({ owner: user });
    if (cart.products.some(_product => _product.product._id.toString() == product._id.toString())) {
        var cartProduct = cart.products.find((_product) => _product.product._id.toString() == product._id.toString());
        if (quantity == 'all') {
            cart.products = cart.products.filter(function (_product) { return _product.product._id.toString() != product._id.toString(); });
        }
        else {
            tempQuantity = parseInt(cartProduct.quantity) - parseInt(quantity);
            if (tempQuantity <= 0) {
                cart.products = cart.products.filter(function (_product) { return _product.product._id.toString() != product._id.toString(); });
            }
            else {
                cartProduct.quantity = tempQuantity;
            }
        }
    }
    await cart.save();
}

cartSchema.statics.getCartbyVendor = async (user) => {
    const cart = await Cart.findOne({ owner: user });

    var products = [];
    for (i = 0; i < cart.products.length; i++) {
        const product = await Product.findById(cart.products[i].product);
        if (!products.some(_product => _product.product._id.toString() == product._id.toString())) {
            products.push({
                product: product,
                quantity: cart.products[i].quantity
            });
        }
    }

    var vendors = [];
    for (i = 0; i < products.length; i++) {
        const vendor = await User.findById(products[i].product.owner);
        if (!vendors.some(_vendor => _vendor._id.toString() == vendor._id.toString())) {
            vendors.push(vendor);
        }
    }

    var groupedProducts = [];
    for (i = 0; i < vendors.length; i++) {
        var filteredProducts = [];
        products.forEach(function (product) {
            if (product.product.owner._id.toString() == vendors[i]._id.toString()) {
                filteredProducts.push(product)
            }
        })
        groupedProducts.push({
            id: vendors[i]._id.toString(),
            username: vendors[i].username,
            vendorName: vendors[i].vendor.vendorName,
            products: filteredProducts
        })
    }

    return groupedProducts;
}

// Define models based on the schema
const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
