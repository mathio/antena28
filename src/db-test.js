const pg = require("pg");
const { MongoClient, ServerApiVersion } = require("mongodb");

(async function () {
  const { MongoClient, ServerApiVersion } = require("mongodb");

  const mongoClient = new MongoClient(process.env.MONGODB_URL, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  const pgClient = new pg.Client(process.env.POSTGRES_URL);
  pgClient.connect();

  // const { rows } = await pgClient.query("select uri from tracks");
  // const uris = rows.map(({ uri }) => uri);
  const uris = [];

  console.log(uris.length);

  const cursorTracks = await mongoClient
    .db("cache")
    .collection("tracks")
    .find({ uri: { $nin: uris } });
  for await (const doc of cursorTracks) {
    const { rows } = await pgClient.query(
      "insert into tracks (id, key, uri, last) values ($1, $2, $3, $4) on conflict do nothing returning id",
      [doc._id.toString(), doc.key, doc.uri, doc.last],
    );
    if (rows.length > 0) {
      console.log(doc.key, rows);
    }
  }

  await mongoClient.close();
  await pgClient.end();
})();
