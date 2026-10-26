import { createApp } from "./app";
import { setupVite, serveStatic, log } from "./vite";

(async () => {
  try {
    const { app, server } = await createApp();

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    const httpServer = server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });

    // Graceful shutdown handling for production
    const gracefulShutdown = (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      httpServer.close(() => {
        console.log('Server closed successfully');
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})().catch((error) => {
  console.error('Unhandled server initialization error:', error);
  process.exit(1);
});
