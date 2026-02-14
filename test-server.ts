console.log('Starting test...');

import dotenv from 'dotenv';
console.log('dotenv imported');

dotenv.config();
console.log('config loaded');

import { createServer } from 'http';
console.log('http imported');

const server = createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
});

const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
