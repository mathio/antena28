const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const getCachedTrack = async (key) => {
  const one = await client.db("cache").collection("tracks").findOne({ key });
  return one?.uri || null;
};

const setCachedTrack = async (key, uri) => {
  await client.db("cache").collection("tracks").insertOne({ key, uri });
};

const getCachedPlaylist = async (key) => {
  const one = await client.db("cache").collection("playlists").findOne({ key });
  if (!one) {
    return null;
  }
  const { uris, next } = one;
  return { uris, next };
};

const setCachedPlaylist = async (key, uris, next) => {
  await client
    .db("cache")
    .collection("playlists")
    .insertOne({ key, uris, next });
};

module.exports = {
  getCachedTrack,
  setCachedTrack,
  getCachedPlaylist,
  setCachedPlaylist,
};
