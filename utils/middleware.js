
const unknownEndpoint = (req, res) => {
  res.status(404).send({ error: 'unknown endpoint' });
}


const errorHandler = (error, req, res, next) => {
  if (error.name === 'TypeError') {
    return res.status(400).send({ error: 'TypeError' });
  }
  next(error);
}


module.exports = {
  unknownEndpoint,
  errorHandler
}