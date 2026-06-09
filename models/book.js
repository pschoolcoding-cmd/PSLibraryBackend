import mongoose from 'mongoose';

const Books = new mongoose.Schema({
  name:{ type:String, default: "none", required: true},
  image: { type:String},
  bid: {type: String, unique: true, required: true},
  description:{type: String, default:""},
  author:{ type: String, required: true},
  genre:{type: Object, default:{}},
  borrowed: {type: String, default:"0"},
  whoadded: {type: String, default:"none"},
  whentoken:{type:String, default:"01/04/0007"}
});

export default mongoose.model('Books', Books);