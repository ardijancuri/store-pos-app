const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const https = require('https');
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');
// const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const shopManagerRoutes = require('./routes/shop-managers');
const settingsRoutes = require('./routes/settings');
const serviceRoutes = require('./routes/services');
const { run } = require('./database/connection');

const app = express();
const PORT = process.env.PORT || 5000;

// Generate self-signed certificates for HTTPS
const generateCertificates = () => {
  const certDir = path.join(__dirname, 'certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
  }

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log('🔐 Generating self-signed certificates...');

    // Generate certificates using selfsigned package
    const attrs = [
      { name: 'commonName', value: '192.168.100.9' },
      { name: 'countryName', value: 'US' },
      { name: 'stateOrProvinceName', value: 'State' },
      { name: 'localityName', value: 'City' },
      { name: 'organizationName', value: 'Local Development' }
    ];

    const pems = selfsigned.generate(attrs, {
      days: 365,
      keySize: 2048,
      algorithm: 'sha256'
    });

    // Write certificates to files
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);

    console.log('✅ Certificates generated successfully');
  }

  return { keyPath, certPath };
};

const { keyPath, certPath } = generateCertificates();

// Trust proxy for rate limiting
// app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiting - COMMENTED OUT FOR DEVELOPMENT
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
//   legacyHeaders: false, // Disable the `X-RateLimit-*` headers
//   keyGenerator: (req) => {
//     return req.ip; // Use IP address as key
//   }
// });
// app.use(limiter);

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://yourdomain.com']
  : [
      'http://localhost:3000',
      'https://localhost:3000',
      'http://127.0.0.1:3000',
      'https://127.0.0.1:3000',
      'https://192.168.100.9:3000', // HTTPS version for network access
      'http://192.168.100.9:3000',  // HTTP version for network access
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser clients
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Explicitly handle preflight
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/shop-managers', shopManagerRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Create HTTP server (simplified for development)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Server accessible at:`);
  console.log(`   - HTTP: http://localhost:${PORT}`);
  console.log(`   - HTTP: http://192.168.100.9:${PORT}`);

  // Ensure barcode column exists (simple migration)
  run(`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(255) UNIQUE`).catch((e) => {
    console.error('Failed ensuring barcode column', e.message);
  });
});