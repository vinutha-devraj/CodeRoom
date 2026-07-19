const mongoose = require('mongoose');
const dbWrapper = require('../models/db');

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 4000 // Timeout in 4 seconds if unable to connect
    });
    console.log("MongoDB Connected ✅");
    dbWrapper.setUseMock(false);
  } catch (err) {
    console.warn("⚠️ MongoDB Connection failed:", err.message);
    console.warn("🚀 Switching to local in-memory Mock Database Mode!");
    dbWrapper.setUseMock(true);
  }
};

module.exports = connectDB;