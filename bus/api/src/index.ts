import "dotenv/config";
import { createApp } from "./app.js";
import { connectDB } from "./db.js";
import { getFirebaseApp } from "./services/firebase.js";
import { seedSuperAdmin } from "./seed.js";

const port = Number(process.env.PORT ?? 4000);
const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bus";

connectDB(uri)
  .then(async () => {
    getFirebaseApp();
    await seedSuperAdmin();
    const app = createApp();
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
