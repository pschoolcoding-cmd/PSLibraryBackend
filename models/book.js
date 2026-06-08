import mongoose from 'mongoose';

const Books = new mongoose.Schema({
  name:{ type:String, default: "none", required: true},
  image: { type:String, default:"https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgk8abFHYLv0a4p7JHLils4vSMFOjdIv_nyfGOCZfELZBh4F4QMdR0k2EfJ5pemlMdIrDXlGAj3HFGqc8746iAzd9zwDz8IVbaRZitaWt1GQWYwLJLU9odfgM-Dj1r-froD4bjwseX88Tfs/s1600/unknown+book.jpg"},
  bid: {type: String, unique: true, required: true},
  description:{type: String, default:""},
  author:{ type: String, required: true},
  genre:{type: Object, default:{}},
  borrowed: {type: String, default:"0"},
  whoadded: {type: String, default:"none"},
  whentoken:{type:String, default:"01/04/0007"}
});

export default mongoose.model('Books', Books);