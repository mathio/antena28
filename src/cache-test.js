const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

(async function () {
  const { MongoClient, ServerApiVersion } = require("mongodb");

  const client = new MongoClient(process.env.MONGODB_URL, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  const cursorTracks = await client
    .db("cache")
    .collection("tracks")
    .find()
    .sort({ key: "asc" });

  for await (const doc of cursorTracks) {
    const [first, ...duplicates] = await client
      .db("cache")
      .collection("tracks")
      .find({ key: doc.key })
      .sort({ last: "desc" })
      .toArray();

    if (duplicates.length > 0) {
      const { deletedCount } = await client
        .db("cache")
        .collection("tracks")
        .deleteMany({
          key: doc.key,
          _id: { $ne: new ObjectId(first._id) },
        });
      console.log(`${first.key} - ${deletedCount}`);
      // } else {
      //   console.log(`${first.key} no duplicates`);
    }
  }

  await client.close();
})();
