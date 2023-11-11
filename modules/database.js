// RMIT University Vietnam
// Course: COSC2430 Web Programming
// Semester: 2023A
// Assessment: Assignment 2
// Author and ID: Le Nguyen Khoi(3975162), Nguyen Thanh Dat(3975867), Tran Anh Tuan(3974799), Le Chanh Tri(3924585)
// ID: Your student ids (e.g. 1234567)
// Acknowledgement: Acknowledge the resources that you use here.

const mongoose = require('mongoose');

// Connect to MongoDB Atlas Database
mongoose.connect('PLACE YOUR DATABASE HERE')
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((error) => console.log(error.message));