const fetch = require("isomorphic-unfetch");
const btoa = require("btoa");
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

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const sleep = (msFrom, msTo) =>
  new Promise((res) =>
    setTimeout(res, msTo ? randomInt(msFrom, msTo) : msFrom),
  );

const extractors = {
  map886: (result) => {
    const data = (result && result.data) || [];
    return data.map((track) => {
      const { name, title } = track || {};
      if (name && title) {
        return `${name} - ${title}`;
      }
    });
  },
  mapRadioRock: (result) => {
    const data = result || [];
    return data.reverse().map((track) => {
      const { artist, title } = track || {};
      if (artist && title) {
        return `${artist} - ${title}`;
      }
    });
  },
};

const getTracks = async (url, extractor, asJson) => {
  let result = {};
  try {
    const response = await fetch(url);
    if (asJson) {
      result = await response.json();
    } else {
      result = await response.text();
    }
  } catch (e) {
    console.error("Failed while fetching tracks:".e);
  }

  return extractor(result).filter((v) => !!v);
};

const register = async () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUrl = process.env.SPOTIFY_REDIRECT_URL;
  const scopes =
    "playlist-read-collaborative playlist-modify-private playlist-modify-public playlist-read-private";

  console.log(
    `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}` +
      `&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
        redirectUrl,
      )}`,
  );
};

const auth = async (code, useAuthCode = false) => {
  const auth = useAuthCode
    ? `grant_type=authorization_code&code=${encodeURIComponent(code)}`
    : `grant_type=refresh_token&refresh_token=${encodeURIComponent(code)}`;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUrl = process.env.SPOTIFY_REDIRECT_URL;

  if (useAuthCode) {
    console.log(auth);
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: `redirect_uri=${encodeURIComponent(redirectUrl)}&${auth}`,
  });
  const data = await response.json();

  if (useAuthCode) {
    console.log(data);
  } else if (data.refresh_token) {
    console.log("WARNING! New refresh_token supplied:", data.refresh_token);
  }

  return data.access_token;
};

let spotifyGlobalAccessToken = null;

const fetchSpotify = async (method, path) => {
  if (!spotifyGlobalAccessToken) {
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
    spotifyGlobalAccessToken = await auth(refreshToken);
  }

  console.log("API:", path);

  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${spotifyGlobalAccessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed while fetching ${path} (${response.status}): ${response.statusText}`,
    );
  }

  await sleep(250, 1000);

  return await response.json();
};

const addToPlaylist = async (playlistId, uris, playlistUrl) => {
  const data = await fetchSpotify(
    "POST",
    `/playlists/${encodeURIComponent(playlistId)}/tracks?uris=${uris.join(
      ",",
    )}`,
  );

  if (data.snapshot_id) {
    console.log(
      `${playlistUrl}: ${uris.length} succesfully added to playlist.`,
    );
  } else {
    console.error("Error adding tracks:", data);
  }
};

const getPlaylistTracks = async (playlistId) => {
  let playlistUrl = `/playlists/${encodeURIComponent(playlistId)}/tracks`;
  let trackUris = [];

  while (playlistUrl) {
    const cached = await getCachedPlaylist(playlistUrl);
    let uris = cached?.uris;
    let nextUrl = cached?.next;

    if (!uris) {
      const data = await fetchSpotify("GET", playlistUrl);
      uris = (data.items && data.items.map((item) => item.track.uri)) || [];
      nextUrl = data.next?.replace("https://api.spotify.com/v1", "") || null;
    }

    trackUris = [...trackUris, ...uris];

    // there is next page = this page is already full = will not be modified = can be cached
    if (nextUrl) {
      await setCachedPlaylist(playlistUrl, uris, nextUrl);
    }
    playlistUrl = nextUrl;
  }

  return trackUris;
};

const findTrack = async (name) => {
  const query = encodeURIComponent(name);

  let uri = await getCachedTrack(query);

  if (!uri) {
    const data = await fetchSpotify("GET", `/search?type=track&q=${query}`);
    uri =
      data.tracks && data.tracks.items.length > 0
        ? data.tracks.items[0].uri
        : null;
  }

  if (!uri) {
    console.error("Unable to find track:", name);
  }

  await setCachedTrack(query, uri);

  return uri;
};

const findAllTracks = async (tracks) => {
  const allTracks = [];
  for (const track of tracks) {
    allTracks.push(await findTrack(track));
  }
  return allTracks;
};

const processRadioPlaylists = async ({
  url,
  spotifyPlaylistId,
  extractor,
  asJson = true,
}) => {
  const tracks = await getTracks(url, extractor, asJson);
  const trackUris = await findAllTracks(tracks);
  const existingTrackUris = await getPlaylistTracks(spotifyPlaylistId);
  const newTrackUris = trackUris.filter(
    (uri) => !!uri && existingTrackUris.indexOf(uri) === -1,
  );
  if (newTrackUris.length > 0) {
    await addToPlaylist(spotifyPlaylistId, newTrackUris, url);
  }
  return newTrackUris;
};

const processNewTracks = async () => {
  const playlists = [
    {
      url: "https://api.radiorock.sk/playlist",
      spotifyPlaylistId: "1yhKr5UrTXJWRtCJSWZNWt",
      extractor: extractors.mapRadioRock,
    },
    {
      url: "https://meta.radio886.at/HardRock",
      spotifyPlaylistId: "7Ec0rNNvVzASYJ6XaQmc4w",
      extractor: extractors.map886,
    },
    {
      url: "https://meta.radio886.at/NewRock",
      spotifyPlaylistId: "2VSTBfKYYUbZL3QORXYX7D",
      extractor: extractors.map886,
    },
    {
      url: "https://meta.radio886.at/ClassicRock",
      spotifyPlaylistId: "77N4roRdtoPPagHdBxjUwd",
      extractor: extractors.map886,
    },
    {
      url: "https://meta.radio886.at/886",
      spotifyPlaylistId: "1xv0WP1QQKYTeUN3LJ9UEy",
      extractor: extractors.map886,
    },
  ];

  for (let i = 0; i < playlists.length; i += 1) {
    if (i > 0) {
      await sleep(1000, 3000);
    }
    await processRadioPlaylists(playlists[i]);
  }

  process.exit(0);
};

// SETUP:
// 1. create app in https://developer.spotify.com/dashboard/
// 2. populate env vars "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET" and "SPOTIFY_REDIRECT_URL"
// 3. call register() to get login link and open it in browser
// 4. authorize the app for your spotify account in browser
// 5. you wil be redirected to non-existing URL with "code" parameter in query
// 6. paste the "code" value below to "authCode" variable
// 7. uncomment console.logs in "auth()" below and run "auth(authCode, true)"
// 8. put the value from "refresh_token" to env var "SPOTIFY_REFRESH_TOKEN"
// register();
// const authCode = "AQCAl_83rjvWj7psdI1cfw967NdT-088r_If9ZsVEhJn1M9i3NVQJ9NdAjFkvmjad0whvSnBs55eJDGaATEIF4bOJ4LIRmJUY1enl5GbWwLahM85S3Rwvgv577LQhejqt5fLdPPZEH76Jj-CIqDB9xgZOmMrAQgWa16nc_UQhJegxpMqUi1GGxUrh9NsxW9omEaqPRohh3nULBdJJ49K18vNlu6G30q5La67jhesu4k38oIiXPFBgFZnixA-RU1ABPDIrUfhyJu7V8XaiuMkoOrstpEuCNeqvXK79A8CQUBd_7zpamkfCTs6GD1O";
// auth(authCode, true);

// WORK WORK:
processNewTracks();
