const AmazonData = (amazonProduct) => {
  // Extract numeric price
  const price = parseFloat(amazonProduct.price.replace(/[₹,]/g, '')) || 0;
  const basePrice = parseFloat(amazonProduct.basePrice.replace(/[₹,]/g, '')) || 0;
  
  // Extract processor details
  const processorDetails = {
    brand: amazonProduct.details["Processor Brand"] || "",
    name: amazonProduct.details["Processor Type"] || "",
    speed: amazonProduct.details["Processor Speed"] || "",
    cores: parseInt(amazonProduct.details["Processor Count"]) || 0
  };
  
  return {
    productName: amazonProduct.title,
    brandName: amazonProduct.details.Brand || "",
    currentPrice: price,
    originalPrice: basePrice,
    discount: basePrice > 0 ? Math.round(((basePrice - price) / basePrice) * 100) : 0,
    currency: 'INR',
    source: 'amazon',
    sourceId: amazonProduct.asin,
    sourceUrl: amazonProduct.url,
    rating: parseFloat(amazonProduct.rating) || 0,
    ratingsCount: parseInt(amazonProduct.ratingsNumber.replace(/[,]/g, '')) || 0,
    processor: processorDetails,
    memory: {
      ramSize: parseInt(amazonProduct.details["RAM Size"]) || 0,
      ramType: amazonProduct.details["Memory Technology"] || "",
      maxRamSupported: parseInt(amazonProduct.details["Maximum Memory Supported"]) || 0
    },
    storage: {
      primaryType: amazonProduct.details["Hard Disk Description"] || "",
      primarySize: parseInt(amazonProduct.details["Hard Drive Size"]) || 0
    },
    display: {
      screenSize: parseFloat(amazonProduct.details["Standing screen display size"]) || 0,
      resolution: amazonProduct.details["Screen Resolution"] || "",
      touchscreen: false
    },
    operatingSystem: amazonProduct.details["Operating System"] || "",
    weightKg: parseFloat(amazonProduct.details["Item Weight"]?.split(' ')[0]) || 0,
    color: amazonProduct.details["Colour"] || "",
    battery: {
      lifeHours: parseInt(amazonProduct.details["Average Battery Life (in hours)"]) || 0
    },
    additionalDetails: amazonProduct.details,
    features: amazonProduct.details.Features || [],
    images: amazonProduct.details.imageLinks || []
  };
};

const FlipkartData = (flipkartProduct) => {
  // Extract numeric price
  const price = parseFloat(flipkartProduct.price.replace(/[₹,]/g, '')) || 0;
  const basePrice = parseFloat(flipkartProduct.basePrice.replace(/[₹,]/g, '')) || 0;
  
  const tech = flipkartProduct.technicalDetails;
  
  return {
    productName: flipkartProduct.productName,
    brandName: tech["Brand"] || tech.Model?.split(' ')[0] || "",
    currentPrice: price,
    originalPrice: basePrice,
    discount: basePrice > 0 ? Math.round(((basePrice - price) / basePrice) * 100) : 0,
    currency: 'INR',
    source: 'flipkart',
    sourceId: flipkartProduct.productId,
    sourceUrl: flipkartProduct.cleanProductLink,
    rating: parseFloat(flipkartProduct.rating) || 0,
    ratingsCount: parseInt(flipkartProduct.ratingsNumber.replace(/[,]/g, '')) || 0,
    processor: {
      brand: tech["Processor Brand"] || "",
      name: tech["Processor Name"] || "",
      variant: tech["Processor Variant"] || ""
    },
    memory: {
      ramSize: parseInt(tech["RAM"]?.replace(/\D/g, '')) || 0,
      ramType: tech["RAM Type"] || ""
    },
    storage: {
      primaryType: tech["Storage Type"] || "",
      primarySize: parseInt(tech["EMMC Storage Capacity"]?.replace(/\D/g, '')) || 0
    },
    display: {
      screenSize: parseFloat(tech["Screen Size"]?.replace(/[^\d.]/g, '')) || 0,
      resolution: tech["Screen Resolution"] || "",
      type: tech["Screen Type"] || "",
      touchscreen: tech["Touchscreen"] === "Yes" 
    },
    operatingSystem: tech["Operating System"] || "",
    weightKg: parseFloat(tech["Weight"]?.replace(/[^\d.]/g, '')) || 0,
    color: tech["Color"] || "",
    additionalDetails: tech,
    images: tech.imageLinks || []
  };
};

module.exports = {
  AmazonData,
  FlipkartData
};