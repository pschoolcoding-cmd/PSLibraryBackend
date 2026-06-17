import express from 'express';
import Books from '../models/book.js';

const router = express.Router();

// GET /books?name=&author=&bid=&q=&page=&limit=&genre=
// - name, author, q support partial, case-insensitive matches
// - bid matches exact bid string
router.get('/', async (req, res) => {
    const { name, author, bid, q, genre, page = 1, limit = 24, sortBy = 'recent' } = req.query;
    const filter = {};
    if (name) filter.name = new RegExp(name, 'i');
    if (author) filter.author = new RegExp(author, 'i');
    if (bid) filter.bid = new RegExp('^' + bid.replace(/[*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (genre) filter.genre = genre;
    
    if (q) {
        const qRegex = new RegExp(q, 'i');
        filter.$or = [{ name: qRegex }, { author: qRegex }];
    }

    try {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        // Grouping logic: Use aggregation to group by ISBN prefix (first 13 chars of bid) and Name
        const pipeline = [
            { $match: filter },
            {
                $addFields: {
                    isbn: { $substr: ["$bid", 0, 13] }
                }
            },
            {
                $group: {
                    _id: { isbn: "$isbn", name: "$name" },
                    doc: { $first: "$$ROOT" },
                    copyCount: { $sum: 1 }
                }
            },
            {
                $replaceRoot: {
                    newRoot: { $mergeObjects: ["$doc", { copyCount: "$copyCount" }] }
                }
            }
        ];

        // Apply Sorting
        if (sortBy === 'name') {
            pipeline.push({ $sort: { name: 1, _id: -1 } });
        } else {
            pipeline.push({ $sort: { _id: -1 } }); // Default to recent
        }

        // Get total groups for correct pagination count
        const countPipeline = [...pipeline];
        countPipeline.push({ $count: "total" });
        const countResult = await Books.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        // Apply Pagination to the groups
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limitNum });

        const books = await Books.aggregate(pipeline);
        
        res.json({
            data: books,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /books/genres
router.get('/genres', async (req, res) => {
  try {
    const genres = await Books.distinct('genre');
    res.json(genres.filter(Boolean).sort());
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
    const { name, bid, author, genre, borrowed, image, description, whoadded } = req.body;
    if (!name || !bid || !author) {
      return res.status(400).json({ error: 'name, bid and author are required' });
    }

    // Set whentaken to current date by default if not provided
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const currentDate = `${day}/${month}/${year}`;

    const book = new Books({ 
      name, 
      bid, 
      author, 
      genre, 
      borrowed, 
      whentaken: req.body.whentaken || currentDate, 
      image, 
      description, 
      whoadded 
    });
    const saved = await book.save();
    res.status(201).json(saved);
  } catch (err) {
    // duplicate key error for unique fields (bid)
    if (err.code === 11000) return res.status(400).json({ error: 'bid must be unique' });
    res.status(500).json({ error: err.message });
  }
});

export default router;

