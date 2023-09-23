// RMIT University Vietnam
// Course: COSC2430 Web Programming
// Semester: 2023A
// Assessment: Assignment 2
// Author and ID: Le Nguyen Khoi(3975162), Nguyen Thanh Dat(3975867), Tran Anh Tuan(3974799), Le Chanh Tri(3924585)
// ID: Your student ids (e.g. 1234567)
// Acknowledgement: Acknowledge the resources that you use here.

const mongoose = require('mongoose');

// Connect to MongoDB Atlas Database
mongoose.connect('mongodb+srv://s3975162:bP7MiI7unEsnlf6Y@cluster0.n34bzjw.mongodb.net/webapp?retryWrites=true&w=majority')
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((error) => console.log(error.message));