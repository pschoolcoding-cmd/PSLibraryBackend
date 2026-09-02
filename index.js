import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import booksRouter from './routes/books.js';
import readersRouter from './routes/readers.js';

const app = express();

// ✅ Only frontend domains go here
const allowedDomains = [
  'http://localhost:5173',
  'https://pslibrary-demo.netlify.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, mobile apps, Postman)
    if (!origin || allowedDomains.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// ✅ MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://PSlibrary:mylibrarypassword@clustergeneral.uwoc4q2.mongodb.net/';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'PSlibrary',
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// ✅ Routes
app.use('/books', booksRouter);
app.use('/readers', readersRouter);

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});