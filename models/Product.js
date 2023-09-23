// RMIT University Vietnam
// Course: COSC2430 Web Programming
// Semester: 2023A
// Assessment: Assignment 2
// Author and ID: Le Nguyen Khoi(3975162), Nguyen Thanh Dat(3975867), Tran Anh Tuan(3974799), Le Chanh Tri(3924585)
// ID: Your student ids (e.g. 1234567)
// Acknowledgement: Acknowledge the resources that you use here.

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

/* The `productSchema.statics.getProductsfromVendor` function is a static method defined on the
`productSchema` object. It is used to retrieve products from a specific vendor based on the provided
username. */
productSchema.statics.getProductsfromVendor = async (username, random = false) => {
    const owner = await User.findOne({ username: username });
    var products = await Product.find({ owner: owner })
    if (random) {
        products = products.sort(() => Math.random() - 0.5);
    }
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

/**
 * The function `getGroupedProducts` retrieves products from the database and groups them by vendor,
 * optionally randomizing the order of the products.
 * @param [random=false] - The "random" parameter is a boolean value that determines whether the
 * products within each vendor group and the vendor groups themselves should be randomly sorted. If
 * "random" is set to true, the products within each vendor group and the vendor groups themselves will
 * be randomly sorted. If "random" is set to
 * @returns an array of grouped products. Each grouped product object contains the following
 * properties: id (vendor's ID), username (vendor's username), profile (vendor's profile), vendorName
 * (vendor's name), and products (an array of products owned by the vendor).
 */
async function getGroupedProducts(random = false) {
    const vendors = await User.find({ "vendor.accountType": true });
    const products = await Product.find({});

    // group products by vendors
    var groupedProducts = [];
    for (i = 0; i < vendors.length; i++) {
        // check if product belong to the current looping vendor
        var filteredProducts = []
        products.forEach(function (product) {
            if (product.owner._id.toString() == vendors[i]._id.toString()) {
                filteredProducts.push(product);
            }
        })

        // random products array
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
    // random vendors array
    if (random) {
        groupedProducts = groupedProducts.sort(() => Math.random() - 0.5);
    }

    return groupedProducts;
}

/* The `productSchema.statics.getProductsbyVendors` function is a static method defined on the
`productSchema` object. It is used to retrieve products from the database and group them by vendors,
with the option to randomize the order of the products. */
productSchema.statics.getProductsbyVendors = async () => {
    return await getGroupedProducts(true);
}

/* The `productSchema.statics.getFilteredProducts` function is a static method defined on the
`productSchema` object. It is used to retrieve products from the database and filter them based on a
minimum and maximum price range. */
productSchema.statics.getFilteredProducts = async (min, max) => {
    // parse to float min max price
    const minPrice = parseFloat(min);
    const maxPrice = parseFloat(max);

    const groupedProducts = await getGroupedProducts();

    // group products by vendors after filter with min and max price
    var filteredGroupedProducts = [];
    for (i = 0; i < groupedProducts.length; i++) {
        const products = groupedProducts[i].products;

        // filter products with min and max price
        var filteredProducts = [];
        for (y = 0; y < products.length; y++) {
            if (minPrice <= products[y].price & products[y].price <= maxPrice) {
                filteredProducts.push(products[y]);
            }
        }

        // if filtered products array not empty, group it into its vendor and push
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

/* The `productSchema.statics.getSearchProducts` function is a static method defined on the
`productSchema` object. It is used to retrieve products from the database and filter them based on a
search query using fuzzy matching. */
productSchema.statics.getSearchProducts = async (query) => {
    const groupedProducts = await getGroupedProducts();

    // parse products' names to an array
    var productsNames = [];
    for (i = 0; i < groupedProducts.length; i++) {
        const products = groupedProducts[i].products;
        for (y = 0; y < products.length; y++) {
            productsNames.push(products[y].name);
        }
    }

    // search with fuzzy string matching
    options = { scorer: fuzz.partial_ratio };
    const fuzzResult = fuzz.extract(query, productsNames, options);
    var filteredFuzzResult = [];
    for (i = 0; i < fuzzResult.length; i++) {
        // select results with matching ratio > 80
        if (fuzzResult[i][1] >= 80) {
            filteredFuzzResult.push(fuzzResult[i]);
        }
    }

    // parse products' names back to product objects
    var matchedSeacthProducts = [];
    for (i = 0; i < groupedProducts.length; i++) {
        const products = groupedProducts[i].products;

        // compare current product loop name with fuzzy result
        var filteredProducts = [];
        for (y = 0; y < products.length; y++) {
            for (z = 0; z < filteredFuzzResult.length; z++) {
                if (products[y].name == filteredFuzzResult[z][0]) {
                    filteredProducts.push(products[y]);
                    break;
                }
            }
        }

        // push if not empty
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
