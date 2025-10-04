import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  revoked: { type: Boolean, default: false },
  replaced_by: { type: mongoose.Schema.Types.ObjectId, ref: "RefreshToken" },
});

export default mongoose.model("RefreshToken", refreshTokenSchema);
