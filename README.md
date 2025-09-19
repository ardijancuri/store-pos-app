# 🏪 Store POS System

A modern Point of Sale (POS) system built with React and Node.js, featuring inventory management, order processing, and shop manager tracking.

## 🚀 Live Demo

- **Frontend**: [https://store-pos-frontend.vercel.app](https://store-pos-frontend.vercel.app)
- **Backend API**: [https://store-pos-backend.vercel.app](https://store-pos-backend.vercel.app)

## ✨ Features

- 📱 **Modern React Frontend** with Vite and Tailwind CSS
- 🔐 **Secure Authentication** with JWT tokens
- 📊 **Inventory Management** with barcode scanning
- 🛒 **Order Processing** with real-time updates
- 👥 **Shop Manager Tracking** for accountability
- 📈 **Dashboard Analytics** with sales reports
- 🛠️ **Service Management** for repair services
- 📱 **Responsive Design** for all devices

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI library
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Lucide React** - Beautiful icons

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - Relational database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Helmet** - Security middleware

### Deployment
- **Vercel** - Frontend hosting
- **Vercel Functions** - Backend API
- **Supabase** - PostgreSQL database

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL database (or use Supabase)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/store-pos.git
   cd store-pos
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Update `.env` with your database credentials:
   ```env
   DB_HOST=your-db-host
   DB_PORT=5432
   DB_NAME=your-db-name
   DB_USER=your-db-user
   DB_PASSWORD=your-db-password
   JWT_SECRET=your-jwt-secret
   ```

4. **Set up the database**
   ```bash
   npm run setup-db
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 🔑 Default Login Credentials

- **Admin Account**
  - Email: `admin@storepos.com`
  - Password: `Admin@2024Secure!`

- **Manager Account**
  - Email: `manager@storepos.com`
  - Password: `Manager@2024!`

## 📁 Project Structure

```
store-pos/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   └── utils/         # Utility functions
│   ├── package.json
│   └── vite.config.js
├── server/                # Node.js backend
│   ├── routes/           # API routes
│   ├── database/        # Database connection & setup
│   ├── middleware/       # Express middleware
│   └── index.js         # Server entry point
├── package.json         # Root package.json
└── README.md
```

## 🔧 Available Scripts

- `npm run dev` - Start both frontend and backend in development
- `npm run client` - Start only frontend
- `npm run server` - Start only backend
- `npm run build` - Build frontend for production
- `npm run setup-db` - Initialize database schema

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Shop Managers
- `GET /api/shop-managers` - Get all managers
- `POST /api/shop-managers` - Create manager
- `PUT /api/shop-managers/:id` - Update manager

## 🚀 Deployment

This project is configured for easy deployment on Vercel:

1. **Frontend**: Automatically deploys from `client/` directory
2. **Backend**: Automatically deploys from `server/` directory
3. **Database**: Uses Supabase PostgreSQL

### Manual Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Set environment variables
4. Deploy!

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Contact: your-email@example.com

---

Made with ❤️ for modern retail businesses