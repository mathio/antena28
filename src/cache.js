const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const isLastAccessDateStale = (last) => {
  const now = Date.now();
  const validMs = 1000 * 60 * 60 * 12; // 12 hours
  return !last || now - validMs > last.getTime();
};

const getCachedTrack = async (key) => {
  const one = await client.db("cache").collection("tracks").findOne({ key });

  if (!one) {
    return null;
  }

  if (isLastAccessDateStale(one.last)) {
    await client
      .db("cache")
      .collection("tracks")
      .updateOne({ key }, { $set: { last: new Date() } });
  }

  return one.uri;
};

const setCachedTrack = async (key, uri) => {
  await client
    .db("cache")
    .collection("tracks")
    .insertOne({ key, uri, last: new Date() });
};

const getCachedPlaylist = async (key) => {
  const one = await client.db("cache").collection("playlists").findOne({ key });
  if (!one) {
    return null;
  }
  const { uris, next } = one;
  return { uris, next };
};

const getCachedPlaylistLastRecordKey = async (playlistId) => {
  const one = await client
    .db("cache")
    .collection("playlists")
    .findOne({ key: { $regex: new RegExp(`^${playlistId}/`) }, next: null });

  return one?.key || null;
};

const setCachedPlaylist = async (key, uris, next) => {
  await client
    .db("cache")
    .collection("playlists")
    .insertOne({ key, uris, next });
};

const deleteCachedPlaylist = async (key) => {
  await client.db("cache").collection("playlists").deleteOne({ key });
};

const disconnectMongoCache = async () => {
  await client.close();
};

module.exports = {
  getCachedTrack,
  setCachedTrack,
  getCachedPlaylist,
  getCachedPlaylistLastRecordKey,
  setCachedPlaylist,
  deleteCachedPlaylist,
  disconnectMongoCache,
};
