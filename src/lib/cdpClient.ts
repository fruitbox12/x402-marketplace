import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config({ path: '.env' }); // Ensure it looks for .env in the project root

let cdpClientInstance: CdpClient;

try {
  // Initialize the CDP client. It automatically loads
  // CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET
  // from the environment variables.
  cdpClientInstance = new CdpClient();
  console.log("CDP Client Initialized Successfully.");
} catch (error) {
  console.error("Error initializing CDP Client:", error);
  // Fallback or throw error, depending on how critical this is for startup
  // For now, we'll allow the app to run but log the error prominently.
  // In a real app, you might want to prevent startup if the client can't init.
  cdpClientInstance = null as any; // Or handle this more gracefully
}

export const cdp = cdpClientInstance; 