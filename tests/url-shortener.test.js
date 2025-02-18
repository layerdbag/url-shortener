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
const { generateShortHash } = require('../app');


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


    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('shortUrl');
    expect(client.set).toHaveBeenCalled(); // Check if Redis was called
  })

  it('should return an error for an invalid URL', async () => {
    const response = await api
      .post('/api/shorten')
      .send({ originalUrl: 'invalid-url' })

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error', 'Invalid URL');
    // expect(client.set).not.toHaveBeenCalled(); // Check if Redis was not called
  })

  it('should handle custom short URLs', async () => {
    const longUrl = 'https://www.example.com';
    const customShort = 'mycustom12'; // Base64 encoded 'cebf2431'
    client.exists.mockResolvedValue(false) // Simulate custom URL availability

    const response = await api
      .post('/api/shorten')
      .send({ originalUrl: longUrl, customShort: customShort })

    expect(response.statusCode).toBe(200);
    expect(response.body.shortUrl).toContain(customShort);
    expect(client.set).toHaveBeenCalledWith(expect.stringContaining(customShort), encodeURIComponent(longUrl)); // Check if Redis was called
  })

  // it('should return an error for a custom short URL that is already in use', async () => {
  //   const longUrl = 'http://www.lighthouselabs.ca';
  //   const customShort = 'existing';
  //   client.exists.mockResolvedValue(true) // Simulate custom URL already in use

  //   const response = await api
  //     .post('/api/shorten')
  //     .send({ originalUrl: longUrl, customShort: customShort })

  //   expect(response.statusCode).toBe(400);
  //   expect(response.body).toHaveProperty('error', 'Custom short URL already in use');
  //   expect(client.set).not.toHaveBeenCalled(); // Check if Redis was not called 
  // })

  // it('should redirect to the original URL', async () => {
  //   const longUrl = 'http://www.lighthouselabs.ca';
  //   const shortUrl = 'b2xVn2';
  //   client.get.mockResolvedValue(longUrl) // Simulate the original URL in Redis

  //   const response = await api
  //     .get(`/api/${shortUrl}`)

  //   expect(response.statusCode).toBe(302);
  //   expect(response.headers.location).toBe(longUrl);
  //   expect(client.get).toHaveBeenCalledWith(shortUrl); // Check if Redis was called
  // })

  // it('should return 404 for an non-existent short URL', async () => {
  //   const shortUrl = 'nonexistent';
  //   client.get.mockResolvedValue(null) // Simulate unknown short URL

  //   const response = await api
  //     .get(`/api/${shortUrl}`)

  //   expect(response.statusCode).toBe(404);
  //   expect(response.body).toHaveProperty('error', 'Short URL not found');
  //   expect(client.get).toHaveBeenCalledWith(shortUrl); // Check if Redis was called
  // })

  // it('should handle collisions', async () => {
  //   const longUrl1 = 'https://www.example.com/url1';
  //   const longUrl2 = 'https://www.example.com/url2'; // Make sure these hash to the same value initially
  //   const initialHash = await generateShortHash(longUrl1); // Get the initial hash

  //   // Mock Redis to simulate a collision on the first attempt
  //   client.set.mockRejectedValueOnce(new Error('Simulated Collision'))

  //   const response1 = await api
  //     .post(`/api/shorten`)
  //     .send({ originalUrl: longUrl1 })

  //   expect(response1.statusCode).toBe(200);
  //   expect(client.set).toHaveBeenCalledWith(
  //     expect.stringContaining(initialHash), encodeURIComponent(longUrl1)
  //   ); // Check if Redis was called

  //   const response2 = await api
  //     .post(`/api/shorten`)
  //     .send({ originalUrl: longUrl2 })
  //   expect(response2.statusCode).toBe(200);
  //   expect(client.set).toHaveBeenCalledWith(
  //     expect.not.stringContaining(initialHash), encodeURIComponent(longUrl2)
  //   ); // Check if Redis was called again
  // })

})