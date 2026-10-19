import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { initDatabase } from './db/store';
import serverTiming = require('./middleware/serverTiming');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Register first so timing headers include all downstream middleware and routes.
app.use(serverTiming);

// Enable CORS for Web (port 5173 / localhost) and Mobile (Expo)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-employee-id', 'If-None-Match', 'If-Modified-Since'],
    exposedHeaders: ['ETag'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'online',
    system: 'ECDIAL System API',
    modules: ['ATTENDANCE_MANAGEMENT', 'QUOTATION_GENERATION'],
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
  });
});

// Initialize database and start listening on all network interfaces (0.0.0.0)
async function startServer() {
  await initDatabase();
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`  ECDIAL Backend API Server running on port ${PORT}`);
    console.log(`  Health Check: http://localhost:${PORT}/health`);
    console.log(`  LAN Base URL: http://192.168.151.50:${PORT}/api`);
    console.log(`====================================================`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
