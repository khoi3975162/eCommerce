const mongoose = require('mongoose');

// Connect to MongoDB Atlas Database
mongoose.connect('mongodb+srv://s3975162:bP7MiI7unEsnlf6Y@cluster0.n34bzjw.mongodb.net/webapp?retryWrites=true&w=majority')
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((error) => console.log(error.message));