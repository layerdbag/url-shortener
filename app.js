const express = require('express')
const app = express()
const redis = require('redis')
const config = require('./utils/config')
const { URL } = require('url') // URL is a built-in module in Node.js
const validUrl = require('valid-url')
const crypto = require('crypto')
const middleware = require('./utils/middleware')

// console.log('connecting to', config.REDIS_URI)

// Redis client setup
let client
(async () => {
  client = redis.createClient();
  client.on('error', (err) => {
    console.log('Redis Client Error:', err);
  });
  await client.connect();
})()


// app.use(express.urlencoded({ extended: true }))


app.use(express.json())

// const urlDatabase = {
//   'b2xVn2': 'http://www.lighthouselabs.ca',
//   '9sm5xK': 'http://www.google.com',
// };

const generateShortHash = async (url) => {
  const hash = crypto.createHash('sha256')
    .update(url).digest('hex')
  const base64 = Buffer.from(hash).toString('base64').slice(0, 10); //Increased length
  return base64;
}

const generateUniqueShortUrl = async (originalUrl, counter = 0) => {
  const timestamp = Date.now().toString(36);
  let combined = originalUrl + timestamp
  if (counter > 0) {
    combined += counter;
  }
  const shortHash = await generateShortHash(combined);
  return shortHash;
}

app.post('/api/shorten', async (req, res) => {
  const { originalUrl, customShort } = req.body

  if (!validUrl.isWebUri(originalUrl)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  let shortUrl
  if (customShort) {
    const hashedCustomShort = await generateShortHash(customShort);
    const existingUrl = await client.get(hashedCustomShort);
    if (existingUrl) {
      return res.status(400).json({ error: 'Custom short URL already in use' })
    }
    shortUrl = hashedCustomShort
  } else {
    shortUrl = await generateUniqueShortUrl(originalUrl);
  }

  // Store the short URL and original URL in Redis
  try {
    await client.set(shortUrl, encodeURIComponent(originalUrl));
    // Return the short URL
    res.json({ shortUrl: `http://localhost:${config.PORT}/${shortUrl}` });
  } catch (err) {
    console.error("Redis error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }


});


app.get('/api/:shortUrl', (req, res) => {
  const { shortUrl } = req.params;
  // console.log(urlDatabase)
  // const originalUrl = urlDatabase[shortUrl];
  if (shortUrl) {
    res.send(shortUrl);
  } else {
    res.status(404).send('URL not found');
  }
});


app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);


module.exports = {
  generateShortHash,
  generateUniqueShortUrl,
}

module.exports = app