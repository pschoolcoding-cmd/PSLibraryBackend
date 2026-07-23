import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Reader from '../models/reader.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'grand_library_jwt_secret_key_2026';

// Helper to remove sensitive fields
const sanitizeReader = (reader) => {
  const obj = reader.toObject ? reader.toObject() : { ...reader };
  delete obj.password;
  return obj;
};

// Middleware: Verify JWT Token
const authenticateReader = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.readerId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// 1. REGISTER / SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingReader = await Reader.findOne({ email: normalizedEmail });

    if (existingReader) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

    const newReader = new Reader({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      avatar: defaultAvatar
    });

    await newReader.save();

    const token = jwt.sign(
      { id: newReader._id, email: newReader.email, role: newReader.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      reader: sanitizeReader(newReader)
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Server error during signup', error: error.message });
  }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const reader = await Reader.findOne({ email: normalizedEmail });

    if (!reader) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    if (!reader.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'This account was created using Google Sign-In. Please sign in with Google.' 
      });
    }

    const isMatch = await bcrypt.compare(password, reader.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: reader._id, email: reader.email, role: reader.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      reader: sanitizeReader(reader)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
  }
});

// 3. GOOGLE SIGN-IN / SIGN-UP
router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId, avatar } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required for Google auth' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let reader = await Reader.findOne({ 
      $or: [{ googleId: googleId || '' }, { email: normalizedEmail }] 
    });

    if (reader) {
      // Update googleId and avatar if missing
      if (!reader.googleId && googleId) reader.googleId = googleId;
      if (avatar && (!reader.avatar || reader.avatar.includes('dicebear'))) reader.avatar = avatar;
      await reader.save();
    } else {
      // Create new reader from Google profile
      const defaultAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`;
      reader = new Reader({
        name: name || email.split('@')[0],
        email: normalizedEmail,
        googleId: googleId || `g_${Date.now()}`,
        avatar: defaultAvatar
      });
      await reader.save();
    }

    const token = jwt.sign(
      { id: reader._id, email: reader.email, role: reader.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Signed in with Google successfully',
      token,
      reader: sanitizeReader(reader)
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ success: false, message: 'Server error during Google auth', error: error.message });
  }
});

// 4. GET CURRENT READER PROFILE (Protected)
router.get('/me', authenticateReader, async (req, res) => {
  try {
    const reader = await Reader.findById(req.readerId);
    if (!reader) {
      return res.status(404).json({ success: false, message: 'Reader account not found' });
    }

    res.json({
      success: true,
      reader: sanitizeReader(reader)
    });
  } catch (error) {
    console.error('Get reader profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reader profile' });
  }
});

// 5. UPDATE PROFILE (Protected)
router.put('/profile', authenticateReader, async (req, res) => {
  try {
    const { name, avatar, password } = req.body;
    const reader = await Reader.findById(req.readerId);

    if (!reader) {
      return res.status(404).json({ success: false, message: 'Reader account not found' });
    }

    if (name) reader.name = name.trim();
    if (avatar) reader.avatar = avatar.trim();

    if (password) {
      reader.password = await bcrypt.hash(password, 10);
    }

    await reader.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      reader: sanitizeReader(reader)
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// 6. BORROW A BOOK (Protected)
router.post('/borrow', authenticateReader, async (req, res) => {
  try {
    const { bookId, bookName, author, image } = req.body;

    if (!bookId) {
      return res.status(400).json({ success: false, message: 'Book ID required' });
    }

    const reader = await Reader.findById(req.readerId);
    if (!reader) {
      return res.status(404).json({ success: false, message: 'Reader account not found' });
    }

    // Check if book already actively borrowed
    const existingBorrow = reader.borrowedBooks.find(
      (b) => b.bookId === bookId && b.status === 'active'
    );

    if (existingBorrow) {
      return res.status(400).json({ success: false, message: 'You have already borrowed this book' });
    }

    reader.borrowedBooks.unshift({
      bookId,
      bookName: bookName || 'Unknown Title',
      author: author || 'Unknown Author',
      image: image || '',
      borrowedDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days loan
      status: 'active'
    });

    await reader.save();

    res.json({
      success: true,
      message: 'Book borrowed successfully!',
      borrowedBooks: reader.borrowedBooks
    });
  } catch (error) {
    console.error('Borrow book error:', error);
    res.status(500).json({ success: false, message: 'Failed to borrow book' });
  }
});

// 7. RETURN A BORROWED BOOK (Protected)
router.post('/return', authenticateReader, async (req, res) => {
  try {
    const { bookId } = req.body;

    const reader = await Reader.findById(req.readerId);
    if (!reader) {
      return res.status(404).json({ success: false, message: 'Reader account not found' });
    }

    const borrowRecord = reader.borrowedBooks.find(
      (b) => b.bookId === bookId && b.status === 'active'
    );

    if (!borrowRecord) {
      return res.status(404).json({ success: false, message: 'Active borrow record not found' });
    }

    borrowRecord.status = 'returned';
    await reader.save();

    res.json({
      success: true,
      message: 'Book returned successfully',
      borrowedBooks: reader.borrowedBooks
    });
  } catch (error) {
    console.error('Return book error:', error);
    res.status(500).json({ success: false, message: 'Failed to return book' });
  }
});

// 8. TOGGLE FAVORITE BOOK (Protected)
router.post('/favorite', authenticateReader, async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId) {
      return res.status(400).json({ success: false, message: 'Book ID required' });
    }

    const reader = await Reader.findById(req.readerId);
    if (!reader) {
      return res.status(404).json({ success: false, message: 'Reader not found' });
    }

    const index = reader.favoriteBooks.indexOf(bookId);
    if (index > -1) {
      reader.favoriteBooks.splice(index, 1);
    } else {
      reader.favoriteBooks.push(bookId);
    }

    await reader.save();

    res.json({
      success: true,
      favoriteBooks: reader.favoriteBooks,
      isFavorite: index === -1
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle favorite' });
  }
});

export default router;
