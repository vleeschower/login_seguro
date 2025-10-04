import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  argon_salt: { type: String, required: true },
  failed_attempts: { type: Number, default: 0 },
  lock_until: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
