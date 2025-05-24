const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true  // Only enforce uniqueness on non-null values
  },
  name: {
    type: String,
    required: true
  },
  // Rest of your schema remains the same
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laptop'
  }],
  history: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laptop'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add username, hash and salt fields to schema
UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);