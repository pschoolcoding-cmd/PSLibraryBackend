import mongoose from 'mongoose';

const ReaderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  surname: {
    type: String,
    default: '',
    trim: true
  },
  birthdate: {
    type: String,
    default: ''
  },
  studentClass: {
    type: String,
    default: ''
  },
  isExternal: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: false // Optional for Google Auth signed up users
  },
  googleId: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['reader', 'admin'],
    default: 'reader'
  },
  borrowedBooks: [
    {
      bookId: { type: String, required: true },
      bookName: { type: String, default: 'Unknown Title' },
      author: { type: String, default: 'Unknown Author' },
      image: { type: String, default: '' },
      borrowedDate: { type: Date, default: Date.now },
      dueDate: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      status: { type: String, enum: ['active', 'returned', 'overdue'], default: 'active' }
    }
  ],
  favoriteBooks: [
    {
      type: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Reader', ReaderSchema);
