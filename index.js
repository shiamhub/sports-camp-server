const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;

    next();
  })
}

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
    client.connect();

    const classesCollection = client.db("sportsDB").collection("classes");
    const usersCollection = client.db("sportsDB").collection("users");
    const cartCollection = client.db("sportsDB").collection("cart");
    const newCollection = client.db("sportsDB").collection("new");
    const paymentsCollection = client.db("sportsDB").collection("payments");

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
      // console.log({token});
      return res.send({ token });
    })

    const verifyRole = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role === 'admin') {
        next();
        return
      }
      if (user?.role === 'instructor') {
        next();
        return
      }
      if (user?.role === 'student') {
        next();
        return
      }
      return res.status(403).send({ error: true, message: 'forbidden access' })
    }

    app.get('/class', async (req, res) => {
      const result = await classesCollection.find({}).sort({ availableSeats: 1 }).toArray();
      return res.send(result);
    })
    app.get('/classes', verifyJWT, verifyRole, async (req, res) => {
      const result = await classesCollection.find({}).toArray();
      return res.send(result);
    })

    app.get('/users', verifyJWT, verifyRole, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      return res.send(result);
    })

    app.get('/addCart', verifyJWT, verifyRole, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      return res.send(result);
    })

    app.get('/user/role/:email', verifyJWT, verifyRole, async (req, res) => {
      const email = req.params.email;

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.send({ role: "student" });
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { role: user?.role }
      return res.send(result);
    })

    app.get('/newClasses', verifyJWT, verifyRole, async (req, res) => {
      const result = await newCollection.find({}).toArray();
      return res.send(result);
    })

    app.get('/newClasses/:id', verifyJWT, verifyRole, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newCollection.findOne(query);
      return res.send(result);
    })

    app.get('/paymentsHistory', verifyJWT, async (req, res) => {
      const query = { email: req?.query?.email };
      const inResult = await paymentsCollection.find(query).sort({ date: -1 }).toArray();
      
      for(let i of inResult) {
        const id = i.addCartItems;
        const query = { _id: new ObjectId(id) };
        const result = await classesCollection.find(query).toArray();
        return res.send({inResult, result});
      }
    })

    app.get('/myClasses', verifyJWT, verifyRole, async (req, res) => {
      const query = { instructorEmail: req.query.email };
      const result = await newCollection.find(query).toArray();
      return res.send(result);
    })

    app.get('/addCartPayment/:id', verifyJWT, verifyRole, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      return res.send(result);
    })
    app.get('/addCart/:id', verifyJWT, verifyRole, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      return res.send(result);
    })

    app.post('/newClasses', verifyJWT, verifyRole, async (req, res) => {
      const newClass = req.body;
      const result = await newCollection.insertOne(newClass);
      return res.send(result);
    })

    app.post('/classes/approved', verifyJWT, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      return res.send(result);
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const exUser = await usersCollection.findOne(query);
      if (exUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user);
      return res.send(result);
    })

    app.post('/addCart', async (req, res) => {
      const query = req.body;
      const result = await cartCollection.insertOne(query);
      return res.send(result);
    })

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // const amount = price * 100
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      return res.send({ clientSecret: paymentIntent.client_secret })
    });

    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);
      // const query = {
      //   _id: { $in: new ObjectId(payment.cartItems) }
      // }
      const query = { _id: new ObjectId(payment.cartItems) }

      const deleteResult = await cartCollection.deleteMany(query);
      return res.send({ insertResult, deleteResult });
    })

    app.patch('/user/admin/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: 'admin' }
      }
      const result = await usersCollection.updateOne(query, updateDoc);
      return res.send(result);
    })

    app.patch('/user/instructor/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: 'instructor' }
      }
      const result = await newCollection.updateOne(query, updateDoc);
      return res.send(result);
    })
    app.patch('/newClasses/approved/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: 'approved', feedBack: "" }
      }
      console.log(updateDoc);
      const result = await newCollection.updateOne(query, updateDoc);
      return res.send(result);
    })
    app.patch('/newClasses/denied/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: 'denied' }
      }
      const result = await newCollection.updateOne(query, updateDoc);
      return res.send(result);
    })
    app.put('/newClasses/denied/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = req.body;
      const updateDoc = {
        $set: {
          image: update.image,
          instructorName: update.instructorName,
          instructorImage: update.instructorImage,
          instructorEmail: update.instructorEmail,
          price : update.price,
          className: update.className,
          availableSeats: update.availableSeats,
          feedBack: update.feedBack,
          status: update.status
        }
      }
      const result = await newCollection.updateOne(query, updateDoc);
      return res.send(result);
    })

    app.delete('/addCart/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      return res.send(result);
    })

    app.delete('/newClasses/denied/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { nid: id };
      const result = await classesCollection.deleteOne(query);
      return res.send(result);
    })

    app.delete('/userDelete/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      return res.send(result);
    })

    // await client.db("admin").command({ ping: 1 });
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