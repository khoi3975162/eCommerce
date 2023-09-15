require('./modules/database');
const auth = require('./modules/auth');
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');

const products = require('./pd/obj/display');

for (i = 0; i < products.length; i++) {
    var product = new Product(products[i]);
    console.log(product)
}