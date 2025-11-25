import mongoose from "mongoose";

const integrationSchema = new mongoose.Schema(
  {
    // Application user ID - stores the logged-in user who owns this integration
    // This links the integration to a specific user account in the system
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required for all integrations"],
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ["instagram", "facebook", "linkedin"],
      index: true,
    },
    // Platform-specific user ID (Instagram account ID, Facebook user ID, etc.)
    platformUserId: {
      type: String,
      required: true,
      index: true,
    },
    // Instagram tokens
    instagramUserAccessToken: {
      token: String,
      expiresAt: Date,
      expiresIn: Number,
      createdAt: Date,
      updatedAt: Date,
    },
    instagramPageAccessToken: {
      token: String,
      expiresAt: Date,
      expiresIn: Number,
      createdAt: Date,
      updatedAt: Date,
    },
    instagramRefreshToken: String,
    instagramPageId: String,
    instagramPageName: String,
    instagramAccountId: String,
    instagramUsername: String,
    // Facebook tokens (same structure as Instagram)
    facebookUserAccessToken: {
      token: String,
      expiresAt: Date,
      expiresIn: Number,
      createdAt: Date,
      updatedAt: Date,
    },
    facebookPageAccessToken: {
      token: String,
      expiresAt: Date,
      expiresIn: Number,
      createdAt: Date,
      updatedAt: Date,
    },
    facebookRefreshToken: String,
    facebookPageId: String,
    facebookPageName: String,
    facebookUserName: String,
    // LinkedIn tokens
    linkedinAccessToken: {
      token: String,
      expiresAt: Date,
      expiresIn: Number,
      createdAt: Date,
      updatedAt: Date,
    },
    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Compound index for efficient queries (user is now required)
integrationSchema.index({ user: 1, platform: 1, platformUserId: 1 }, { unique: true });

// Method to check if token is expired
integrationSchema.methods.isTokenExpired = function (tokenType) {
  const tokenField = this[tokenType];
  if (!tokenField || !tokenField.expiresAt) {
    return false; // No expiration set
  }
  return Date.now() > new Date(tokenField.expiresAt).getTime();
};

// Method to get active token
integrationSchema.methods.getActiveToken = function (tokenType) {
  const tokenField = this[tokenType];
  if (!tokenField || !tokenField.token) {
    return null;
  }
  if (this.isTokenExpired(tokenType)) {
    return null;
  }
  return tokenField.token;
};

const Integration = mongoose.model("Integration", integrationSchema);

export default Integration;
