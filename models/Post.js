const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const PostSchema = new Schema({
    title: String,
    summary: String,
    content: String,
    cover: String,
    author:{type: Schema.Types.ObjectId, ref:'User'}

}, {
    timestamps: true // Pour la date
});


const PostModel = model('Post', PostSchema) // Post = table dans la db

module.exports = PostModel; // On exporte le model