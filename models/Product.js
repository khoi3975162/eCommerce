fuzz = require('fuzzball');
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
            profile: owner.profile,
            vendorName: owner.vendor.vendorName,
            products: products
        }]
    }
    else {
        return false;
    }
}

async function getGroupedProducts(random = false) {
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
        if (random) {
            filteredProducts = filteredProducts.sort(() => Math.random() - 0.5);
        }
        groupedProducts.push({
            id: vendors[i]._id.toString(),
            username: vendors[i].username,
            profile: vendors[i].profile,
            vendorName: vendors[i].vendor.vendorName,
            products: filteredProducts
        })
    }
    if (random) {
        groupedProducts = groupedProducts.sort(() => Math.random() - 0.5);
    }
    return groupedProducts
}

productSchema.statics.getProductsbyVendors = async () => {
    return await getGroupedProducts(true);
}

productSchema.statics.getFilteredProducts = async (min, max) => {
    const minPrice = parseFloat(min);
    const maxPrice = parseFloat(max);

    const groupedProducts = await getGroupedProducts();
    var filteredGroupedProducts = [];

    for (i = 0; i < groupedProducts.length; i++) {
        const products = groupedProducts[i].products;
        var filteredProducts = [];
        for (y = 0; y < products.length; y++) {
            if (minPrice <= products[y].price & products[y].price <= maxPrice) {
                filteredProducts.push(products[y]);
            }
        }
        if (filteredProducts.length > 0) {
            filteredGroupedProducts.push({
                id: groupedProducts[i].id,
                username: groupedProducts[i].username,
                profile: groupedProducts[i].profile,
                vendorName: groupedProducts[i].vendorName,
                products: filteredProducts
            })
        }
    }
    return filteredGroupedProducts;
}

productSchema.statics.getSearchProducts = async (query) => {
    const groupedProducts = await getGroupedProducts();
    var productsNames = [];
    for (i = 0; i < groupedProducts.length; i++) {
        const products = groupedProducts[i].products;
        for (y = 0; y < products.length; y++) {
            productsNames.push(products[y].name);
        }
    }

    options = { scorer: fuzz.partial_ratio };
    const fuzzResult = fuzz.extract(query, productsNames, options);
    var filteredFuzzResult = [];
    for (i = 0; i < fuzzResult.length; i++) {
        if (fuzzResult[i][1] >= 80) {
            filteredFuzzResult.push(fuzzResult[i]);
        }
    }

    var matchedSeacthProducts = [];
    for (i = 0; i < groupedProducts.length; i++) {
        const products = groupedProducts[i].products;
        var filteredProducts = [];
        for (y = 0; y < products.length; y++) {
            for (z = 0; z < filteredFuzzResult.length; z++) {
                if (products[y].name == filteredFuzzResult[z][0]) {
                    filteredProducts.push(products[y]);
                    break;
                }
            }
        }
        if (filteredProducts.length > 0) {
            matchedSeacthProducts.push({
                id: groupedProducts[i].id,
                username: groupedProducts[i].username,
                profile: groupedProducts[i].profile,
                vendorName: groupedProducts[i].vendorName,
                products: filteredProducts
            })
        }
    }
    return matchedSeacthProducts;
}


// Define models based on the schema
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
