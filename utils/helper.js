const crypto = require('crypto')

const generateShortHash = async (url) => {
  const hash = crypto.createHash('sha256')
    .update(url).digest('hex')
  const base64 = Buffer.from(hash).toString('base64').slice(0, 8); //Increased length
  return base64;
}

const generateUniqueShortUrl = async (originalUrl) => {
  const timestamp = Date.now().toString(36);
  const shortHash = await generateShortHash(originalUrl + timestamp);
  return shortHash;
}



module.exports = {
  generateShortHash,
  generateUniqueShortUrl
}