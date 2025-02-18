require('dotenv').config();

const PORT = process.env.PORT
const REDIS_URI = process.env.REDIS_URI

module.exports = {
  PORT,
  REDIS_URI
}
