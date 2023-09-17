const mongoose = require('mongoose');
const User = require('./User');

// Define schema
const productSchema = mongoose.Schema({
    owner: {
        type: 'ObjectId',
        ref: 'User'
    },
    name: {
        type: String,
        required: true,
        minLength: 10,
        maxLength: 20,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    images: [{
        type: String,
        required: true
    }],
    description: {
        type: String,
        maxLength: 500,
        trim: true
    }
})

productSchema.statics.getProductsfromVendor = async (username) => {
    const owner = await User.findOne({ username: username });
    const products = await Product.find({ owner: owner })
    if (products.length != 0) {
        return [{
            id: owner._id,
            username: owner.username,
            vendorName: owner.vendor.vendorName,
            products: products
        }]
    }
    else {
        return false;
    }
}

productSchema.statics.getProductsbyVendors = async () => {
    const vendors = await User.find({ "vendor.accountType": true });
    const products = await Product.find({});
    var groupedProducts = [];
    for (i = 0; i < vendors.length; i++) {
        var filteredProducts = []
        products.forEach(function (product) {
            if (product.owner._id.toString() == vendors[i]._id.toString()) {
                filteredProducts.push(product)
            }
        })
        groupedProducts.push({
            id: vendors[i]._id.toString(),
            username: vendors[i].username,
            vendorName: vendors[i].vendor.vendorName,
            products: filteredProducts.sort(() => Math.random() - 0.5)
        })
    }
    return groupedProducts.sort(() => Math.random() - 0.5);
}


// Define models based on the schema
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
