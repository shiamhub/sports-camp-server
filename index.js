const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.np7fjqr.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const classesCollection = client.db("sportsDB").collection("classes");
    const usersCollection = client.db("sportsDB").collection("users");
    const cartCollection = client.db("sportsDB").collection("cart");

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
      res.send({ token });
    })

    app.get('/class', async (req, res) => {
      const result = await classesCollection.find({}).toArray();
      res.send(result);
    })

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    })
    app.get('/addCart', async (req, res) => {
      const result = await cartCollection.find({}).toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const exUser = await usersCollection.findOne(query);
      if (exUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.post('/addCart', async (req, res) => {
      const query = req.body;
      const result = await cartCollection.insertOne(query);
      res.send(result);
    })

    app.patch('/user/admin/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: 'admin' }
      }
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    })
    app.patch('/user/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: 'instructor' }
      }
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    })
    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
})
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})