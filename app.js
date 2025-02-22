const express = require('express')
const app = express()
const redis = require('redis')
const config = require('./utils/config')
const { URL } = require('url') // URL is a built-in module in Node.js
const validUrl = require('valid-url')
const { generateShortHash, generateUniqueShortUrl } = require('./utils/helper_functions')
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



app.use(express.json())

// const urlDatabase = {
//   'b2xVn2': 'http://www.lighthouselabs.ca',
//   '9sm5xK': 'http://www.google.com',
// };



app.post('/api/shorten', async (req, res) => {
  const { originalUrl, customShort } = req.body

  if (!validUrl.isWebUri(originalUrl)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  let shortUrl;
  if (customShort) {
    const hashedCustomShort = await generateShortHash(customShort);
    const exists = await client.exists(hashedCustomShort);
    if (exists) {
      return res.status(400).json({ error: 'Custom short URL already in use' })
    }
    shortUrl = hashedCustomShort
  } else {
    shortUrl = await generateShortHash(originalUrl); // Initial attempt
  }

  // Store the short URL and original URL in Redis
  try {
    await client.set(shortUrl, encodeURIComponent(originalUrl));
    res.json({ shortUrl: `http://localhost:${config.PORT}/${shortUrl}` });
  } catch (err) { // Initial set failed (possible collision)
    console.error("First Redis set error:", err);

    if (err.message.includes('Simulated Collision') ||
      err.message.includes('ERR Duplicate key')) { // Check if the error message is related to duplicate key/collision
      // This is important as different Redis clients may have different error messages.
      try {
        shortUrl = await generateUniqueShortUrl(originalUrl); // Generate a new short URL
        await client.set(shortUrl, encodeURIComponent(originalUrl)); // Try again
        res.json({ shortUrl: `http://localhost:${config.PORT}/${shortUrl}` }); // Success!
      } catch (secondErr) { // Second set failed
        console.error("Second Redis set error:", secondErr);
        return res.status(500).json({ error: 'Internal server error' }); // Some other Redis error
      }
    }

  }

});


// app.get('/api/:shortUrl', (req, res) => {
//   const { shortUrl } = req.params;
//   // console.log(urlDatabase)
//   // const originalUrl = urlDatabase[shortUrl];
//   if (shortUrl) {
//     res.send(shortUrl);
//   } else {
//     res.status(404).send('URL not found');
//   }
// });


app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);


module.exports = app