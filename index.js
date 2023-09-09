const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clustermain.vdf6goj.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userPost = client.db("techFusion").collection("userAllPost");
    const userInfo = client.db("techFusion").collection("userInformation");
    const userHistory = client.db("techFusion").collection("userHistory");
    const allTags = client.db("techFusion").collection("tags");
    const bookmarkCollection = client.db("techFusion").collection("bookmarks");

    // all user post will add this collection in db
    app.post("/userpost", async (req, res) => {
      const userPosts = req.body;
      const result = await userPost.insertOne(userPosts);
      res.send(result);
    });

    // all bookmarks to DB
    app.post("/bookamark", async (req, res) => {
      const bookmarks = req.body;
      const result = await bookmarkCollection.insertOne(bookmarks);
      res.send(result);
    });

    // gett bookmarked data from DB
    app.get("/bookmarked/:email", async (req, res) => {
      const userEmail = req.params.email;
      const bookmarkEntries = await bookmarkCollection
        .find({ user: userEmail })
        .toArray();
      const postIds = bookmarkEntries.map((entry) => entry.postId);
      const filter = {
        _id: { $in: postIds.map((postId) => new ObjectId(postId)) },
      };
      const bookmarkedPosts = await userPost.find(filter).toArray();
      res.send(bookmarkedPosts);
    });

    // signup user information track in db
    app.post("/signedUserInfo", async (req, res) => {
      const userInformations = req.body;
      // Set the default inbox structure
      userInformations.inbox = [
        {
          sender: "admin@gmail.com",
          senderImage: "https://i.ibb.co/fvJSJ4P/User-Circle.png",
          messages: [
            {
              message: "Welcome to the tech fusion",
              timeStamp: new Date(),
            },
          ],
        },
      ];
      const result = await userInfo.insertOne(userInformations);
      res.send(result);
    });

    // added USER HIstory in DB
    app.post("/userhistory", async (req, res) => {
      const usershistoryInfo = req.body;
      // Check if user's email exists in the userhistory collection
      const existingUserHistory = await userHistory.findOne({
        userEmail: usershistoryInfo.userEmail,
      });
      if (existingUserHistory) {
        // Update the existing document by pushing postId to the postId array
        const updatedUserHistory = await userHistory.updateOne(
          { _id: existingUserHistory._id },
          { $push: { postId: usershistoryInfo.postId } }
        );
        res.send(updatedUserHistory);
      } else {
        // Create a new document with the user's email and postId array
        const newUserHistory = await userHistory.insertOne({
          userEmail: usershistoryInfo.userEmail,
          postId: [usershistoryInfo.postId],
        });
        res.send(newUserHistory);
      }
    });

    // added comments on each post
    app.post("/addcomments", async (req, res) => {
      const postComments = req.body;
      const filter = { _id: new ObjectId(postComments.postId) };
      // const options = { upsert: true };
      const updateDoc = {
        $push: {
          comments: {
            comment: postComments.commentValue,
            commentuser: postComments.commentUser,
            time: postComments.timeStamp,
            commentorImg: postComments.userImg,
          },
        },
      };
      const result = await userPost.updateOne(filter, updateDoc);
      res.send(result);
    });

    // post the messages into userInfo for inbox
    app.post("/messages/:email", async (req, res) => {
      const useremail = req.params.email;
      const message = req.body;
      const myEmail = req.body.email;
      const queryUser = { email: useremail, "inbox.sender": myEmail };

      // Check if there is an existing inbox object for the sender
      const existingUserInbox = await userInfo.findOne(queryUser);

      if (existingUserInbox) {
        // Update the existing object with the new message
        const updateDoc = {
          $push: {
            "inbox.$.messages": {
              message: message.data.message,
              timeStamp: new Date(),
            },
          },
        };

        const result = await userInfo.updateOne(queryUser, updateDoc);
      } else {
        // Create a new inbox object for the sender
        const newInboxObject = {
          sender: myEmail,
          senderImage: req.body.senderImage,
          messages: [{ message: message.data.message, timeStamp: new Date() }],
        };

        const updateDoc = {
          $push: {
            inbox: newInboxObject,
          },
        };

        const result1 = await userInfo.updateOne(
          { email: useremail },
          updateDoc
        );
      }

      // =============================
      // save this copy for senders profile
      const findSenders = await userInfo.findOne({ email: myEmail });
      const filter = { email: useremail };
      const findReciver = await userInfo.findOne(filter);

      const queryReceiver = {
        "sentMessages.receiver": findReciver.email,
      };
      const isReceiver = await userInfo.findOne(queryReceiver);
      if (isReceiver) {
        const updatedocs = {
          $push: {
            "sentMessages.$.messages": {
              message: message.data.message,
              timeStamp: new Date(),
            },
          },
        };
        const result = await userInfo.updateOne(queryReceiver, updatedocs);
      } else {
        const uppdatedDoc = {
          receiver: findReciver.email,
          reciverImage: findReciver.image,
          messages: [{ message: message.data.message, timeStamp: new Date() }],
        };

        const finalUpdate = {
          $push: {
            sentMessages: uppdatedDoc,
          },
        };

        const result = await userInfo.updateOne(findSenders, finalUpdate);
      }
      res.json({ message: "Message sent successfully" });
    });

    // ===========================================
    // =============================================

    // post the messages into userInfo for inbox from inbox by email
    // app.post("/inboxmessages/:email", async (req, res) => {
    //   const userEmail = req.params.email;
    //   const message = req.body;
    //   const myEmail = req.body.email;
    //   const queryUser = { email: userEmail, "inbox.sender": myEmail };

    //   // Check if there is an existing inbox object for the sender
    //   const existingUserInbox = await userInfo.findOne(queryUser);

    //   if (existingUserInbox) {
    //     // Update the existing object with the new message
    //     const updateDoc = {
    //       $push: {
    //         "inbox.$.messages": {
    //           message: message.data.message,
    //           timeStamp: new Date(),
    //         },
    //       },
    //     };

    //     const result = await userInfo.updateOne(queryUser, updateDoc);
    //     console.log(result);
    //   } else {
    //     // Create a new inbox object for the sender
    //     const newInboxObject = {
    //       sender: myEmail,
    //       senderImage: req.body.senderImage,
    //       messages: [{ message: message.data.message, timeStamp: new Date() }],
    //     };

    //     const updateDoc = {
    //       $push: {
    //         inbox: newInboxObject,
    //       },
    //     };

    //     const result1 = await userInfo.updateOne(
    //       { email: userEmail },
    //       updateDoc
    //     );
    //   }

    //   // =============================
    //   // save this copy for senders profile
    //   const findSenders = await userInfo.findOne({ email: myEmail });
    //   const filter = { email: userEmail, "inbox.receiver": myEmail };
    //   const findReciver = await userInfo.findOne(filter);

    //   const queryReceiver = {
    //     "sentMessages.receiver": findReciver?.email,
    //   };
    //   const isReceiver = await userInfo.findOne(queryReceiver);
    //   if (isReceiver) {
    //     const updatedocs = {
    //       $push: {
    //         "sentMessages.$.messages": {
    //           message: message.data.message,
    //           timeStamp: new Date(),
    //         },
    //       },
    //     };
    //     const result = await userInfo.updateOne(
    //       { email: myEmail, "sentMessages.receiver": findReciver?.email },
    //       updatedocs
    //     );
    //   } else {
    //     const uppdatedDoc = {
    //       receiver: findReciver.email,
    //       reciverImage: findReciver.image,
    //       messages: [{ message: message.data.message, timeStamp: new Date() }],
    //     };

    //     const finalUpdate = {
    //       $push: {
    //         sentMessages: uppdatedDoc,
    //       },
    //     };

    //     const result = await userInfo.updateOne(
    //       { email: myEmail },
    //       finalUpdate
    //     );
    //   }
    //   res.json({ message: "Message sent successfully" });
    // });

    app.post("/inboxmessages/:email", async (req, res) => {
      try {
        const userEmail = req.params.email;
        const message = req.body;
        const myEmail = req.body.email;

        // Create a new inbox object for the sender
        const newInboxObject = {
          sender: myEmail,
          senderImage: req.body.senderImage,
          messages: [{ message: message.data.message, timeStamp: new Date() }],
        };

        // Update the recipient's inbox with the new message
        const updateRecipient = {
          $push: {
            inbox: newInboxObject,
          },
        };

        await userInfo.updateOne({ email: userEmail }, updateRecipient);

        // Save a copy for the sender's profile
        const newSentMessage = {
          receiver: userEmail,
          receiverImage: req.body.receiverImage,
          messages: [{ message: message.data.message, timeStamp: new Date() }],
        };

        // Update the sender's sentMessages with the new message
        const updateSender = {
          $push: {
            sentMessages: newSentMessage,
          },
        };

        await userInfo.updateOne({ email: myEmail }, updateSender);

        res.json({ message: "Message sent successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred" });
      }
    });

    // ===========================================
    // =============================================

    //get the all information by email from userInformation
    app.get("/userinfoemail/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userInfo.find(query).toArray();
      res.send(result);
    });

    //get the all information by email from userInformation
    app.get("/myinbox/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userInfo.find(query).toArray();
      // const inboxedUsers = result.map((c) =>
      //   c?.sentMessages?.map((d) => d.receiver)
      // );
      // console.log(inboxedUsers);
      res.send(result);
    });

    //get the all history by user email for up down answers
    app.get("/userhistinfo/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await userHistory.find(query).toArray();
      res.send(result);
    });

    //get the all post for home page
    app.get("/posts", async (req, res) => {
      const result = await userPost.find().sort({ _id: -1 }).toArray();
      res.send(result);
    });

    //get the all tags
    app.get("/tags", async (req, res) => {
      const result = await allTags.find().toArray();
      res.send(result);
    });

    //get the all users
    app.get("/users", async (req, res) => {
      const result = await userInfo.find().sort({ _id: -1 }).toArray();
      res.send(result);
    });

    //get the all users by query method for testing
    app.get("/allusers", async (req, res) => {
      const result = await userInfo.find().toArray();
      res.send(result);
    });

    //get the all post by email from userpost
    app.get("/postbyuser/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user: email };
      const result = await userPost.find(query).sort({ _id: -1 }).toArray();
      res.send(result);
    });

    //update user information from dashboar personalizaion
    app.patch("/updateInfo/:email", async (req, res) => {
      const email = req.params.email;
      const updatesInfo = req.body;
      const options = { upsert: true };
      const query = { email: email };
      const updateDoc = {
        $set: {
          image: updatesInfo.image,
          name: updatesInfo.name,
          bio: updatesInfo.bio,
        },
      };
      const result = await userInfo.updateOne(query, updateDoc, options);
      res.send(result);
    });

    //update upmark for a post
    app.patch("/upmark/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: {
          upMark: +1,
        },
      };
      const result = await userPost.findOneAndUpdate(filter, updateDoc);
      res.send(result);
    });

    //update downmark for a post
    app.patch("/downmark/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: {
          downMark: +1,
        },
      };
      const result = await userPost.findOneAndUpdate(filter, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Techfusion server workeed");
});

app.listen(port, () => {
  console.log(`techfusion server run on ${port}`);
});
