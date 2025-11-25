import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track last cron job execution time per user for Instagram and Facebook
const INSTAGRAM_CRON_EXECUTION_FILE = path.join(
  path.dirname(__dirname),
  "tokens",
  ".instagram_cron_execution.json"
);
const FACEBOOK_CRON_EXECUTION_FILE = path.join(
  path.dirname(__dirname),
  "tokens",
  ".facebook_cron_execution.json"
);

/**
 * Get the last cron job execution time for a specific Instagram user
 * @param {string} userId - Instagram user ID
 * @returns {number|null} Last execution timestamp or null if never executed
 */
export function getLastInstagramCronExecution(userId) {
  try {
    if (fs.existsSync(INSTAGRAM_CRON_EXECUTION_FILE)) {
      const data = fs.readFileSync(INSTAGRAM_CRON_EXECUTION_FILE, "utf8");
      const json = JSON.parse(data);
      return json[userId]?.lastExecution || null;
    }
    return null;
  } catch (error) {
    console.error(
      `❌ Error reading last Instagram cron execution time for userId ${userId}:`,
      error
    );
    return null;
  }
}

/**
 * Save the current cron job execution time for a specific Instagram user
 * @param {string} userId - Instagram user ID
 */
export function saveLastInstagramCronExecution(userId) {
  try {
    let data = {};
    if (fs.existsSync(INSTAGRAM_CRON_EXECUTION_FILE)) {
      try {
        const fileData = fs.readFileSync(INSTAGRAM_CRON_EXECUTION_FILE, "utf8");
        data = JSON.parse(fileData);
      } catch (parseError) {
        console.error("❌ Error parsing Instagram cron execution file, creating new:", parseError);
        data = {};
      }
    }

    data[userId] = {
      lastExecution: Date.now(),
      lastExecutionDate: new Date().toISOString(),
    };

    fs.writeFileSync(INSTAGRAM_CRON_EXECUTION_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(
      `❌ Error saving last Instagram cron execution time for userId ${userId}:`,
      error
    );
  }
}

/**
 * Get the last cron job execution time for a specific Facebook user
 * @param {string} userId - Facebook user ID
 * @returns {number|null} Last execution timestamp or null if never executed
 */
export function getLastFacebookCronExecution(userId) {
  try {
    if (fs.existsSync(FACEBOOK_CRON_EXECUTION_FILE)) {
      const data = fs.readFileSync(FACEBOOK_CRON_EXECUTION_FILE, "utf8");
      const json = JSON.parse(data);
      return json[userId]?.lastExecution || null;
    }
    return null;
  } catch (error) {
    console.error(
      `❌ Error reading last Facebook cron execution time for userId ${userId}:`,
      error
    );
    return null;
  }
}

/**
 * Save the current cron job execution time for a specific Facebook user
 * @param {string} userId - Facebook user ID
 */
export function saveLastFacebookCronExecution(userId) {
  try {
    let data = {};
    if (fs.existsSync(FACEBOOK_CRON_EXECUTION_FILE)) {
      try {
        const fileData = fs.readFileSync(FACEBOOK_CRON_EXECUTION_FILE, "utf8");
        data = JSON.parse(fileData);
      } catch (parseError) {
        console.error("❌ Error parsing Facebook cron execution file, creating new:", parseError);
        data = {};
      }
    }

    data[userId] = {
      lastExecution: Date.now(),
      lastExecutionDate: new Date().toISOString(),
    };

    fs.writeFileSync(FACEBOOK_CRON_EXECUTION_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`❌ Error saving last Facebook cron execution time for userId ${userId}:`, error);
  }
}

/**
 * Setup and start the cron job for token refresh
 * @param {Function} checkAndRefreshTokens - Function to check and refresh tokens
 */
export function setupTokenRefreshCron(checkAndRefreshTokens) {
  // Set to 50 days - cron job will only execute if 50 days have passed since last execution
  // You can customize via TOKEN_REFRESH_INTERVAL_DAYS environment variable
  const DAYS_SINCE_LAST_REFRESH = process.env.TOKEN_REFRESH_INTERVAL_DAYS
    ? parseFloat(process.env.TOKEN_REFRESH_INTERVAL_DAYS)
    : 50; // Default: 50 days

  // Setup cron job to check weekly (but only executes if 50 days have passed)
  // Cron format: minute hour day month dayOfWeek
  // "0 2 * * 0" means: at 2:00 AM every Sunday
  // The job checks if 50 days have passed since last execution, and only then runs the refresh
  // You can customize via TOKEN_REFRESH_CRON environment variable
  const CRON_SCHEDULE = process.env.TOKEN_REFRESH_CRON || "0 2 * * 0"; // Default: weekly on Sunday at 2 AM

  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`\n⏰ Cron job check triggered at ${new Date().toISOString()}`);

    // Check and refresh tokens for both Instagram and Facebook
    // The checkAndRefreshTokens function will check per-user execution times internally
    console.log(`✅ Executing token refresh check for all users`);

    await checkAndRefreshTokens(DAYS_SINCE_LAST_REFRESH);
  });

  console.log(`✅ Token refresh cron job scheduled: ${CRON_SCHEDULE}`);
  console.log(`   Refresh interval: ${DAYS_SINCE_LAST_REFRESH} days`);

  // Also run immediately on startup (optional - comment out if not needed)
  // Uncomment the line below if you want to check tokens on server startup
  // checkAndRefreshTokens(DAYS_SINCE_LAST_REFRESH);
}
