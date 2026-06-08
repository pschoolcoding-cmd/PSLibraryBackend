import express from 'express';
import Books from '../models/book.js';

const router = express.Router();

// GET /books?name=&author=&bid=
// - name and author support partial, case-insensitive matches
// - bid matches exact bid string
router.get('/', async (req, res) => {
  const { name, author, bid } = req.query;
  const filter = {};
  if (name) filter.name = new RegExp(name, 'i');
  if (author) filter.author = new RegExp(author, 'i');
  if (bid) filter.bid = bid;

  try {
    const books = await Books.find(filter);
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /books/:id - try Mongo _id first, then bid field

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let book = null;
    // try by MongoDB _id when the id looks like a 24-hex string
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      book = await Books.findById(id);
    }
    if (!book) {
      book = await Books.findOne({ bid: id });
    }
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /books - requires a valid API key to create a book
+// Provide key via X-API-KEY header or in body as `key`. The server looks for BOOK_POST_KEY env var or uses a default.
router.post('/', async (req, res) => {
  const expectedKey = process.env.BOOK_POST_KEY || 'supersecret';
  const providedKey = req.header('x-api-key') || req.body?.key;
  if (providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    const { name, bid, author, genre, borrowed, whentoken } = req.body;
    if (!name || !bid || !author) {
      return res.status(400).json({ error: 'name, bid and author are required' });
    }

    const book = new Books({ name, bid, author, genre, borrowed, whentoken });
    const saved = await book.save();
    res.status(201).json(saved);
  } catch (err) {
    // duplicate key error for unique fields (bid)
    if (err.code === 11000) return res.status(400).json({ error: 'bid must be unique' });
    res.status(500).json({ error: err.message });
  }
});

export default router;

