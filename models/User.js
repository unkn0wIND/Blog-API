const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, min: 4, unique: true },
    password: { type: String, required: true}

});


const UserModel = mongoose.model('User', UserSchema) // users = table dans la db

module.exports = UserModel; // On exporte le model