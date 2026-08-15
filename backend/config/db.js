const dns = require('dns');
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' && err.syscall === 'querySrv') {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      } catch (err2) {
        console.error(`MongoDB connection error: ${err2.message}`);
        throw err2;
      }
    }
    console.error(`MongoDB connection error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
