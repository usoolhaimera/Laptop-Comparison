const express = require('express');
const mongoose = require('mongoose');
const { importCSVData } = require('./csvtojson.js')


const Laptop = require('./model/Laptop.js');
const Comment = require('./model/Review.js');

const {AmazonData, FlipkartData} = require('./utils/dataFill.js');

const amazonData = require('./Data/amazon_complete_data.json');
const flipkartData = require('./Data/flipkart_complete_data.json');

const path = require('path');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./model/users.js');
//.env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });



const cors = require('cors');

// const PORT = process.env.PORT || 8080;
const corsOptions = {
  origin: ["http://localhost:5173"]
}

const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


//Seassion and Passport setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'laptop-compare-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
        maxAge: 1000 * 60 * 60 * 24 * 7
          
    } // Set to true if using HTTPS
}))

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//MongoDB connection
connectDB().catch(err=> console.log(err));
async function connectDB(){
    //add your own connection string
    try{
        await mongoose.connect(process.env.Local_URL || process.env.Mongo_URL);
        // console.log(process.env.Mongo_URL);
        console.log('Database Connected');
    }catch(err){
        console.log(err);
    }
}



//api routes

//Authentication API
app.post('/api/register',async(req,res)=>{
    try{
        const {email,password,userName} = req.body;
        const user = new User({
            email,
            username: userName,
        });
        const registeredUser = await User.register(user,password);

        req.login(registeredUser,(err) =>{
            if(err){
                console.log('Login Error',err);
                return res.status(500).json({success:false,message:'Login Error'});
            }
            res.status(200).json({success:true,message:'User Registered Successfully'});
        })

    }catch(err){
        console.log('Registration Error',err);
        res.status(500).json({success:false,message:'Server Error'});
    }
});
//Login API
app.post('/api/login',passport.authenticate('local'),(req,res)=>{
    res.status(200).json({success:true,message:'User Logged In Successfully'});

});
//Logout API
app.get('/api/logout',(req,res)=>{
    req.logout((err)=>{
        if(err){
            console.log('Logout Error',err);
            return res.status(500).json({success:false,message:'Logout Error'});
        }
        res.status(200).json({success:true,message:'User Logged Out Successfully'});
    });
});
//Check Authentication API
app.get('/api/check-auth',(req,res)=>{
    if(req.isAuthenticated()){
        res.status(200).json({success:true,user:req.user});
    }else{
        res.status(401).json({success:false,message:'User Not Authenticated'});
    }
});

//Data filling API

app.get('/import/amazon', async(req, res) => {
    try {
      const transformedData = amazonData.map(AmazonData);
      await Laptop.insertMany(transformedData);
      res.status(200).json({success: true, message: 'Data Imported Successfully'});
    } catch(err) {
      console.log('Error importing Amazon data:', err);
      res.status(500).json({success: false, message: 'Error importing Amazon data'});
    }
});

app.get('/import/flipkart', async(req, res) => {
    try {
      const transformedData = flipkartData.map(FlipkartData);
      await Laptop.insertMany(transformedData);
      res.status(200).json({success: true, message: 'Data Imported Successfully'});
    } catch(err) {
      console.log('Error importing Flipkart data:', err);
      res.status(500).json({success: false, message: 'Error importing Flipkart data'});
    }
});

app.get('/api/insertonetime',async(req,res)=>{
    res.send('API is working');
    try{
        const data =await importCSVData();
        // console.log(data);
        await Laptop.insertMany(data);
        console.log('Data Imported Successfully');

  } catch (err) {
    console.log(err);
  }


});
//All details API
app.get('/api/search', async (req, res) => {
  const { id, name, price, processor, ram, os, storage, img_link, display, rating, no_of_ratings, no_of_reviews, laptop_brand, os_brand, page = 1 } = req.query;


  let query = {
    ...(id && { laptop_id: id }),
    ...(name && { name }),
    ...(price && { price }),
    ...(processor && { processor }),
    ...(ram && { ram }),
    ...(os && { os }),
    ...(storage && { storage }),
    ...(img_link && { img_link }),
    ...(display && { display }),
    ...(rating && { rating }),
    ...(no_of_ratings && { no_of_ratings }),
    ...(no_of_reviews && { no_of_reviews }),
    ...(laptop_brand && { laptop_brand }),
    ...(os_brand && { os_brand })
  };

  const limit = 50;
  const skip = (page - 1) * limit;

  try {
    const laptops = await Laptop.find(query)
      .limit(limit)
      .skip(skip);

    const totalResults = await Laptop.countDocuments(query); // Get total number of matching documents
    const hasNext = page * limit < totalResults; // Check if there are more results

    res.status(200).json({
      success: true,
      laptops,
      hasNext,
      totalResults,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalResults / limit)
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }

})
//Advaced Search API
app.get('/api/advancedsearch', async (req, res) => {
  try {
    // Extract query parameters
    const { 
      query, price_min, price_max, ram, processor, storage, 
      laptop_brand, os, rating_min, sort_by, sort_order, page = 1, limit = 30 
    } = req.query;

    // Build the filter object
    const filter = {};

    // Text search across multiple fields if query is provided
    if (query) {
      const terms = query.split(/\s+/).filter(Boolean);
      const fieldsToSearch = [
        'name', 'ram', 'processor', 'os', 'storage',
        'laptop_brand', 'os_brand', 'processor_brand', 'usecases'
      ];

      filter.$and = terms.map(term => ({
        $or: fieldsToSearch.map(field => ({
          [field]: { $regex: term, $options: 'i' }
        }))
      }));
    }

    // Add specific filters
    if (price_min || price_max) {
      filter.price = {};
      if (price_min) filter.price.$gte = parseFloat(price_min);
      if (price_max) filter.price.$lte = parseFloat(price_max);
    }

    if (ram) {
      // Handle multiple RAM options
      const ramOptions = Array.isArray(ram) ? ram : [ram];
      filter.ram = { $in: ramOptions.map(r => new RegExp(r, 'i')) };
    }

    if (processor) {
      // Handle multiple processor options
      const processorOptions = Array.isArray(processor) ? processor : [processor];
      filter.processor = { $in: processorOptions.map(p => new RegExp(p, 'i')) };
    }

    if (storage) {
      // Handle multiple storage options
      const storageOptions = Array.isArray(storage) ? storage : [storage];
      filter.storage = { $in: storageOptions.map(s => new RegExp(s, 'i')) };
    }

    if (laptop_brand) {
      // Handle multiple brand options
      const brandOptions = Array.isArray(laptop_brand) ? laptop_brand : [laptop_brand];
      filter.laptop_brand = { $in: brandOptions.map(b => new RegExp(b, 'i')) };
    }

    if (os) {
      // Handle multiple OS options
      const osOptions = Array.isArray(os) ? os : [os];
      filter.os = { $in: osOptions.map(o => new RegExp(o, 'i')) };
    }

    if (rating_min) {
      filter.rating = { $gte: parseFloat(rating_min) };
    }

    // Create sort object
    const sortOptions = {};
    if (sort_by) {
      sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;
    } else {
      // Default sorting
      sortOptions.rating = -1;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Execute the query
    const laptops = await Laptop.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .select('name laptop_id img_link price processor ram storage rating laptop_brand os');

    // Get total count for pagination
    const totalResults = await Laptop.countDocuments(filter);
    const totalPages = Math.ceil(totalResults / limitNum);

    // Return results
    res.json({
      success: true,
      laptops,
      pagination: {
        total: totalResults,
        page: parseInt(page),
        limit: limitNum,
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (err) {
    console.error('Error in advanced search:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


//Suggestions API(auto complete)
app.get('/api/suggestions', async (req, res) => {
  const query = req.query.query || '';
  try {
    const suggestions = await Laptop.find({
      name: { $regex: query, $options: 'i' }
    })
      .limit(30)
      .select('name laptop_id img_link price processor ram rating laptop_brand');

    res.json(suggestions);
  } catch (err) {
    console.error('Error fetching suggestions:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Filer API
app.get('/api/filter', async (req, res) => {
  const { processor, ram, os, storage, price } = req.query;

  let filter = {};

  if (processor) {
    filter.processor = { $regex: processor, $options: 'i' };
  }
  if (ram) {
    filter.ram = { $regex: ram, $options: 'i' };
  }
  if (os) {
    filter.os = { $regex: os, $options: 'i' };
  }
  if (storage) {
    filter.storage = { $regex: storage, $options: 'i' };
  }
  if (price) {
    const [minPrice, maxPrice] = price.split('-').map(Number);
    filter.price = { $gte: minPrice, $lte: maxPrice };
  }
  try {
    const laptops = await Laptop.find(filter);
    res.status(200).json({ success: true, laptops });
  } catch (err) {
    console.error('Error fetching filtered laptops:', err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

//Get User API

//Comment API
app.post("/api/comment", async (req, res) => {
  const { user, laptop, comment } = req.body;

  if (!user || !laptop || !comment) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    const newComment = new Comment({ user, laptop, comment });
    await newComment.save();
    res.status(200).json({ success: true, message: "Comment added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(8080, () => {
  console.log('Server Started at port 8080');
})