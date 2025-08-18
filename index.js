import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import { upload } from "./cloudinary.js"; // import the configured upload


const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);


const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "bazarbd_ads", // folder name in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: (req, file) => Date.now() + "-" + file.originalname, // unique filename
  },
});


export const upload = multer({ storage });

app.use(cors()); 
app.use(express.json()); 






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vdaznfz.mongodb.net/bazarBD?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
   
    
    // await client.connect();
    const database = client.db("bazarBD");
    const productsCollection = database.collection("products");
    const usersCollection = database.collection("users");
    const advertisementsCollection = database.collection("advertisements");
    const purchasesCollection = database.collection("purchase");

     const reviewsCollection = database.collection("reviews");
     const watchlistCollection = database.collection("watchlist");
    


    
     
 app.post("/products", async (req, res) => {
  try {
    const product = req.body;

    if (product.prices && Array.isArray(product.prices)) {
      product.prices = product.prices.map(priceObj => ({
        ...priceObj,
        date: new Date(priceObj.date), 
      }));
    }

    const result = await productsCollection.insertOne(product);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error inserting product:", error);
    res.status(500).json({ error: "Failed to insert product" });
  }
});

    
    
    app.get("/products", async (req, res) => {
  try {
    const products = await productsCollection
      .find({ status: "approved" })
      .limit(8)
      .toArray();
    res.status(200).json(products); 
    
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});


    

app.get("/products/vendor", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Vendor email is required" });
  }

  try {
    const products = await productsCollection
      .find({ vendorEmail: email }) 
      .toArray();
      res.status(200).json(products); 
  } catch (error) {
    console.error("Error fetching vendor products:", error);
    res.status(500).json({ error: "Failed to fetch vendor products" });
  }
});
  

app.get("/products/all", async (req, res) => {
  try {
    let { page = 0, size = 6 } = req.query;
    page = parseInt(page);
    size = parseInt(size);

    const total = await productsCollection.countDocuments({});
    const products = await productsCollection
      .find({})
      .skip(page * size)
      .limit(size)
      .toArray();

    res.status(200).json({ products, total });
  } catch (error) {
    console.error("Error fetching all products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/products/all-no-limit", async (req, res) => {
  try {
    const products = await productsCollection
      .find({ status: "approved" })  
      .toArray();  

    res.status(200).json(products);  
  } catch (error) {
    console.error("Error fetching all approved products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});




    
app.get("/products/search", async (req, res) => {
  try {
    const { sort, date, from, to, status, page = 0, size = 6 } = req.query;

    const query = {};
    if (status) query.status = status;

    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(selectedDate.getDate() + 1);
      query["prices"] = {
        $elemMatch: {
          date: { $gte: selectedDate, $lt: nextDay },
        },
      };
    }

    if (from && to) {
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query["prices"] = {
        $elemMatch: {
          date: { $gte: fromDate, $lte: toDate },
        },
      };
    }

    const total = await productsCollection.countDocuments(query);

    let products = await productsCollection
      .find(query)
      .skip(parseInt(page) * parseInt(size))
      .limit(parseInt(size))
      .toArray();

    if (sort === "asc") {
      products.sort((a, b) => {
        const priceA = a.prices?.[0]?.price ?? Infinity;
        const priceB = b.prices?.[0]?.price ?? Infinity;
        return priceA - priceB;
      });
    } else if (sort === "desc") {
      products.sort((a, b) => {
        const priceA = a.prices?.[0]?.price ?? -Infinity;
        const priceB = b.prices?.[0]?.price ?? -Infinity;
        return priceB - priceA;
      });
    }

    res.status(200).json({ total, products });
  } catch (error) {
    console.error("Error fetching filtered/sorted products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});




  
app.get("/reviews", async (req, res) => {
  const { productId, rating, sortByDate } = req.query;

  try {
    let query = {};
    if (productId) {
      query.productId = new ObjectId(productId);
    }
    if (rating) {
      query.rating = parseInt(rating);
    }

    
    let sortOptions = { date: -1 }; 
    if (sortByDate === 'asc') {
      sortOptions = { date: 1 }; 
    }

    const reviews = await reviewsCollection
      .find(query)
      .sort(sortOptions)
      .toArray();

    if (reviews.length === 0) {
      return res.status(404).send({ error: "No reviews found" });
    }

    res.send(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).send({ error: "Failed to fetch reviews" });
  }
});




  
    app.get("/products/:id/price-history", async (req, res) => {
      const { id } = req.params;
      const product = await productsCollection.findOne({ _id: new ObjectId(id) });

      if (!product || !product.prices) return res.status(404).send([]);
      const sortedPrices = product.prices.sort((a, b) => new Date(a.date) - new Date(b.date));
      res.send(sortedPrices);
    });

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    
    app.get("/reviews/:productId", async (req, res) => {
      const { productId } = req.params;
      const reviews = await reviewsCollection
        .find({ productId })
        .sort({ date: -1 })
        .toArray();
      res.send(reviews);
    });



    app.post('/create-payment-intent', async (req, res) => {
  const { amountInPoysha } = req.body;

  console.log("Received amountInPoysha:", amountInPoysha);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPoysha,
      currency: 'bdt', 
      payment_method_types: ['card'],
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error); 
    res.status(500).json({ error: error.message });
  }
});




    
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid Product ID" });
        }
        const product = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (!product) {
          return res.status(404).send({ error: "Product not found" });
        }
        res.json(product); 
      } catch (error) {
        console.error("Error getting product:", error);
        res.status(500).send({ error: "Server Error" });
      }
    });

    
    app.put("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid Product ID" });
        }
        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        if (result.modifiedCount === 0) {
          return res.status(404).send({ error: "Product not found or no changes made" });
        }
        res.send({ success: true, message: "Product updated successfully" });
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send({ error: "Update failed" });
      }
    });

    
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid Product ID" });
        }
        const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).send({ error: "Product not found" });
        }
        res.send({ success: true, message: "Product deleted successfully" });
      } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).send({ error: "Delete failed" });
      }
    });

    
    app.patch("/products/approve/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "approved", rejectionReason: "", rejectionFeedback: "" } }
        );
        res.send({ success: true, message: "Product approved" });
      } catch (error) {
        console.error("Error approving product:", error);
        res.status(500).send({ error: "Failed to approve product" });
      }
    });

    
    app.patch("/products/reject/:id", async (req, res) => {
      const { id } = req.params;
      const { reason, feedback } = req.body;

      if (!reason || !feedback) {
        return res.status(400).send({ error: "Reason and feedback are required" });
      }

      try {
        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "rejected",
              rejectionReason: reason,
              rejectionFeedback: feedback
            }
          }
        );
        res.send({ success: true, message: "Product rejected" });
      } catch (error) {
        console.error("Error rejecting product:", error);
        res.status(500).send({ error: "Failed to reject product" });
      }
    });



  app.post('/watchlist', async (req, res) => {
  const newItem = req.body;

  const exists = await watchlistCollection.findOne({
    productId: newItem.productId,
    userEmail: newItem.userEmail,
  });

  if (exists) {
    return res.status(409).send({ message: 'Already in watchlist' });
  }

  const product = await productsCollection.findOne({
    _id: new ObjectId(newItem.productId),
  });

  if (!product) {
    return res.status(404).send({ message: 'Product not found' });
  }

  const enrichedItem = {
    ...newItem,
    itemName: product.itemName || 'Unnamed',
    marketName: product.marketName || 'Unknown',
    date: new Date(),
  };

  const result = await watchlistCollection.insertOne(enrichedItem);
  res.send(result);
});




app.get("/watchlist", async (req, res) => {
  const email = req.query.email?.toLowerCase();
  console.log("Received email:", email);  

  if (!email) return res.status(400).send({ error: "Email is required" });

  const result = await watchlistCollection.find({ userEmail: email }).toArray();
  res.send(result);
});

app.get("/watchlist/all", async (req, res) => {
  try {
    const allWatchlists = await watchlistCollection.find({}).toArray();
    res.send(allWatchlists);
  } catch (error) {
    console.error("Error fetching all watchlists:", error);
    res.status(500).send({ error: "Failed to fetch all watchlists" });
  }
});


app.delete("/watchlist/:id", async (req, res) => {
  const id = req.params.id;
  const result = await watchlistCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});



// GET a user by email
app.get("/users/:email", async (req, res) => {
  const email = req.params.email?.toLowerCase();
  if (!email) return res.status(400).send({ error: "Email is required" });

  try {
    const user = await usersCollection.findOne({ email: email });
    if (!user) return res.status(404).send({ error: "User not found" });
    res.send(user);
  } catch (error) {
    console.error("Error fetching user by email:", error);
    res.status(500).send({ error: "Server error" });
  }
});


    app.post("/users", async (req, res) => {
      const userData = req.body;
      try {
        const existingUser = await usersCollection.findOne({ email: userData.email });
        if (existingUser) {
          return res.send({ success: false, message: "User already exists" });
        }
        const result = await usersCollection.insertOne(userData);
        res.send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send({ success: false, error: "Server Error" });
      }
    });

    
    app.get("/users", async (req, res) => {
  try {
    const search = req.query.search || "";
    const searchRegex = new RegExp(search, "i"); 
    const users = await usersCollection
      .find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } }
        ]
      })
      .toArray();

    res.send(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ success: false, error: "Server Error" });
  }
});


   
    app.patch("/users/role/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: role } }
      );
      res.send(result);
    });

  

    app.get('/orders', async (req, res) => { 
  const email = req.query.email?.toLowerCase(); 
  console.log("Received email query:", email); 

  if (!email) {
    return res.status(400).json({ error: "Email query is required" });
  }

  try {
    const result = await purchasesCollection.find({ buyerEmail: email }).toArray();  
    console.log("Orders found:", result); 
    res.send(result); 
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});


app.get('/all-orders', async (req, res) => { 
  try {
    const result = await purchasesCollection.find({}).toArray();  
    res.send(result); 
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ error: "Failed to fetch all orders" });
  }
});





app.post('/orders', async (req, res) => {
  const purchase = req.body;
  console.log("Received purchase:", purchase);  

  try {
    const result = await purchasesCollection.insertOne(purchase);
    console.log("Purchase saved successfully:", result); 
    res.status(201).json(result);
  } catch (error) {
    console.error("Error saving purchase:", error);
    res.status(500).json({ error: error.message || "Failed to save purchase" });
  }
});






    
 app.post("/advertisements", upload.single("image"), async (req, res) => {
  try {
    const { adTitle, description, vendorEmail } = req.body;

    if (!adTitle || !description || !vendorEmail || !req.file) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    // ✅ Cloudinary automatically adds `req.file.path` with the uploaded image URL
    const adData = {
      adTitle,
      description,
      vendorEmail,
      image: req.file.path,  // cloudinary URL instead of /uploads/filename
      status: "pending",
      createdAt: new Date(),
    };

    const result = await advertisementsCollection.insertOne(adData);

    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error("Error saving ad:", error);
    res.status(500).json({ success: false, error: "Failed to submit ad" });
  }
});
    
    app.get("/advertisements", async (req, res) => {
      const { status, email } = req.query;
      let query = {};
      if (status) query.status = status;
      if (email) query.vendorEmail = email;

      try {
        const ads = await advertisementsCollection.find(query).toArray();
        res.send(ads);
      } catch (error) {
        console.error("Error fetching advertisements:", error);
        res.status(500).send({ success: false, error: "Failed to fetch ads" });
      }
    });

    
    app.put("/advertisements/:id", async (req, res) => {
      const id = req.params.id;
      const { adTitle, description } = req.body;

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid Advertisement ID" });
        }

        const result = await advertisementsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { adTitle, description } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send({ error: "Ad not found or no changes made" });
        }

        res.send({ success: true, message: "Ad updated successfully" });
      } catch (error) {
        console.error("Error updating ad:", error);
        res.status(500).send({ error: "Failed to update ad" });
      }
    });

    
    app.patch("/advertisements/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      try {
        const result = await advertisementsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Advertisement not found" });
        }

        res.send({ success: true, message: "Status updated successfully" });
      } catch (error) {
        console.error("Error updating ad status:", error);
        res.status(500).json({ error: "Failed to update status" });
      }
    });

    
    app.delete("/advertisements/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await advertisementsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).send({ error: "Advertisement not found" });
        }
        res.send({ success: true });
      } catch (err) {
        console.error("Error deleting ad:", err);
        res.status(500).send({ error: "Failed to delete ad" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log("Successfully connected to MongoDB!");
  } catch (error) {
    console.error("Error in MongoDB connection:", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BazarBD server is running...");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
