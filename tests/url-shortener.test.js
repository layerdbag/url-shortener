const supertest = require('supertest');
const redis = require('redis');



// Mock Redis client
jest.mock('redis', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(), // Mock connect
    get: jest.fn(),
    set: jest.fn(),
    exists: jest.fn(),
    on: jest.fn(), // Mock the 'on' method
  };
  return {
    createClient: () => mockClient,
  }
});

const client = redis.createClient(); // Get the mocked client

const app = require('../app');
const api = supertest(app);
const { generateShortHash } = require('../utils/helper');


describe('URL Shortener API', () => {
  beforeEach(() => {
    client.get.mockClear();
    client.set.mockClear();
    client.exists.mockClear();
  })

  it('should shorten a valid URL', async () => {
    const longUrl = 'http://www.lighthouselabs.ca';
    const response = await api
      .post('/api/shorten')
      .send({ originalUrl: longUrl })


    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('shortUrl');
    expect(client.set).toHaveBeenCalled(); // Check if Redis was called
  })

  it('should return an error for an invalid URL', async () => {
    const response = await api
      .post('/api/shorten')
      .send({ originalUrl: 'invalid-url' })

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error', 'Invalid URL');
    expect(client.set).not.toHaveBeenCalled(); // Check if Redis was not called
  })

  it('should handle an available custom short URL (hashed)', async () => {
    const longUrl = 'https://www.example.com';
    const customShort = 'mycustomlink';

    const hashedCustomShort = await generateShortHash(customShort); // Get the hashed custom short URL

    // Mock Redis to simulate the custom URL is *not* already in use
    client.get.mockResolvedValue(null)

    const response = await api
      .post('/api/shorten')
      .send({ originalUrl: longUrl, customShort: customShort })

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('shortUrl');
    expect(response.body.shortUrl).toContain(hashedCustomShort); // Expect the *hashed* value
    expect(client.set).toHaveBeenCalled(); // Check if Redis was called
    // Important check: Check if the url has been encoded
    expect(client.set).toHaveBeenCalledWith(hashedCustomShort, encodeURIComponent(longUrl));
  })

  it('should return an error for unavailable custom short URL (hashed)', async () => {
    const longUrl = 'https://www.example.com';
    const customShort = 'mycustomlink';

    const hashedCustomShort = await generateShortHash(customShort);

    // Mock Redis *BEFORE* the request are made
    client.exists.mockResolvedValue(true) // Simulate custom URL already in use

    const response = await api
      .post('/api/shorten')
      .send({ originalUrl: longUrl, customShort: customShort })

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error', 'Custom short URL already in use');
    expect(client.set).not.toHaveBeenCalled(); // Check if Redis was not called 
  })

  it('should redirect to the original URL', async () => {
    const shortUrl = 'shortened0';
    const longUrl = 'https://www.example.com/amen';
    client.get.mockResolvedValue(longUrl) // Simulate the original URL in Redis

    const response = await api
      .get(`/api/${shortUrl}`)

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(longUrl);
    expect(client.get).toHaveBeenCalledWith(shortUrl); // Check if Redis was called
  })

  it('should return 404 for an non-existent short URL', async () => {
    const shortUrl = 'nonexistent';
    client.get.mockResolvedValue(null) // Simulate unknown short URL

    const response = await api
      .get(`/api/${shortUrl}`)

    expect(response.statusCode).toBe(404);
    expect(response.body).toHaveProperty('error', 'Short URL not found');
    expect(client.get).toHaveBeenCalledWith(shortUrl); // Check if Redis was called
  })

  it('should handle collisions', async () => {
    const longUrl1 = 'https://www.example.com/url1';
    const longUrl2 = 'https://www.example.com/url2'; // Make sure these hash to the same value initially
    const initialHash = await generateShortHash(longUrl1); // Get the initial hash

    // Mock Redis to simulate a collision on the first attempt
    client.set.mockRejectedValueOnce(new Error('Simulated Collision'))

    const response1 = await api
      .post(`/api/shorten`)
      .send({ originalUrl: longUrl1 })

    expect(response1.statusCode).toBe(201);
    expect(client.set).toHaveBeenCalledTimes(2); // Ensure set is called twice (initial and retry)
    expect(client.set).toHaveBeenCalledWith(
      expect.stringContaining(initialHash), encodeURIComponent(longUrl1)
    ); // Check if Redis was called

    const response2 = await api
      .post(`/api/shorten`)
      .send({ originalUrl: longUrl2 })
    expect(response2.statusCode).toBe(201);
    expect(client.set).toHaveBeenCalledWith(
      expect.not.stringContaining(initialHash), encodeURIComponent(longUrl2)
    ); // Check if Redis was called again
  })

})