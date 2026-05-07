import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';

// Import Routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import profilesRoutes from './routes/profiles';
import campaignsRoutes from './routes/campaigns';
import leadsRoutes from './routes/leads';
import callActivitiesRoutes from './routes/callActivities';
import callbacksRoutes from './routes/callbacks';
import dailyMetricsRoutes from './routes/dailyMetrics';
import notificationsRoutes from './routes/notifications';
import monitorRoutes from './routes/monitor';
import aiRoutes from './routes/ai';
import reportsRoutes from './routes/reports';
import crmRoutes from './routes/crm';
import whatsappRoutes from './routes/whatsapp';
import { startNotificationWorker } from './services/notificationWorker';

const app = express();
const httpServer = createServer(app);

// Replaces Supabase Realtime
export const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Load API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/call-activities', callActivitiesRoutes);
app.use('/api/callbacks', callbacksRoutes);
app.use('/api/daily-metrics', dailyMetricsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Socket.io for Realtime data
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  
  // Join user room for targeted notifications
  socket.on('authenticate', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`[Socket.io] User ${userId} joined their notification room`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Start background workers
startNotificationWorker(io);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

httpServer.listen(config.port, () => {
  console.log(`==========================================`);
  console.log(`🚀 BangBet API server running on port ${config.port}`);
  console.log(`📡 Socket.io realtime server initialized`);
  console.log(`==========================================`);
});
