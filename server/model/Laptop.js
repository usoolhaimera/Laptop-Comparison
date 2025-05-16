const mongoose = require('mongoose');

const LaptopSchema = new mongoose.Schema({
  // Common standardized fields
  productName: { type: String, required: true }, // From Amazon.title or Flipkart.productName
  brandName: { type: String, required: true }, // Extract from product name or details
  
  // Pricing information
  currentPrice: { type: Number }, // Normalized numeric price without currency symbol
  originalPrice: { type: Number }, // Base price without currency symbol
  discount: { type: Number }, // Calculated discount percentage
  currency: { type: String, default: 'INR' },
  
  // Source information
  source: { type: String, enum: ['amazon', 'flipkart', 'other'] },
  sourceId: { type: String }, // asin or productId
  sourceUrl: { type: String },
  
  // Reviews and ratings
  rating: { type: Number },
  ratingsCount: { type: Number },
  
  // Key specifications (most common ones extracted to top level)
  processor: {
    brand: String,
    name: String,
    series: String,
    generation: String,
    cores: Number,
    speed: String
  },
  memory: {
    ramSize: Number, // in GB
    ramType: String,
    maxRamSupported: Number
  },
  storage: {
    primaryType: String, // SSD, HDD, eMMC
    primarySize: Number, // in GB
    secondaryType: String,
    secondarySize: Number
  },
  display: {
    screenSize: Number, // in inches
    resolution: String,
    type: String,
    refreshRate: Number,
    touchscreen: Boolean
  },
  graphics: {
    type: String, // Integrated or Discrete
    brand: String,
    model: String
  },
  operatingSystem: String,
  
  // Physical characteristics
  dimensions: {
    width: Number,
    height: Number,
    depth: Number,
    unit: String
  },
  weightKg: Number,
  color: String,
  
  // Battery information
  battery: {
    type: String,
    cells: Number,
    capacity: Number,
    lifeHours: Number
  },
  
  // Additional details (store all other specifications)
  additionalDetails: { type: mongoose.Schema.Types.Mixed },
  
  // Features list
  features: [String],
  
  // Images
  images: [String],
  
  // Timestamps
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Add indexes for common queries
LaptopSchema.index({ productName: 'text' });
LaptopSchema.index({ brandName: 1 });
LaptopSchema.index({ currentPrice: 1 });
LaptopSchema.index({ processor: 1 });

module.exports = mongoose.model('Laptop', LaptopSchema);