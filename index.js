const fetch = require("isomorphic-unfetch");
const btoa = require("btoa");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

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

const getTracks = async (url, extractor) => {
  let result = {};
  try {
    const response = await fetch(url);
    result = await response.json();
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

const addToPlaylist = async (accessToken, playlistId, uris, playlistUrl) => {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(
      playlistId,
    )}/tracks?uris=${uris.join(",")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const data = await response.json();

  if (data.snapshot_id) {
    console.log(
      `${playlistUrl}: ${uris.length} succesfully added to playlist.`,
    );
  } else {
    console.error("Error adding tracks:", data);
  }
};

const getPlaylistTracks = async (accessToken, playlistId) => {
  let playlistUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(
    playlistId,
  )}/tracks`;
  let trackUris = [];

  while (playlistUrl) {
    const response = await fetch(playlistUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    const uris = (data.items && data.items.map((item) => item.track.uri)) || [];
    trackUris = [...trackUris, ...uris];
    playlistUrl = data.next;
  }

  // console.log(trackUris);

  return trackUris;
};

const findTrack = async (accessToken, name) => {
  const response = await fetch(
    `https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(
      name,
    )}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const data = await response.json();

  const uri =
    data.tracks && data.tracks.items.length > 0
      ? data.tracks.items[0].uri
      : null;

  // console.log({name, uri});

  if (!uri) {
    console.error("Unable to find track:", name);
  }

  return uri;
};

const processRadioPlaylists = async (
  { url, spotifyPlaylistId, extractor },
  accessToken,
) => {
  const tracks = await getTracks(url, extractor);
  const trackUris = await Promise.all(
    tracks.map((track) => findTrack(accessToken, track)),
  );
  const existingTrackUris = await getPlaylistTracks(
    accessToken,
    spotifyPlaylistId,
  );
  const newTrackUris = trackUris.filter(
    (uri) => !!uri && existingTrackUris.indexOf(uri) === -1,
  );
  if (newTrackUris.length > 0) {
    await addToPlaylist(accessToken, spotifyPlaylistId, newTrackUris, url);
  }
  return newTrackUris;
};

const processNewTracks = async () => {
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  const accessToken = await auth(refreshToken);

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
    await processRadioPlaylists(playlists[i], accessToken);
  }
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
// const authCode = "AQBNvn_g8Z3v52m8yVpecSAXuwEBBM1H84d7YXZagotvsmBb_6GzAKmu7ygrVKUJzMG6wOHXrxqhsdZR7T7dWfmwAd-MSWPNHQpbc3uCnv14i1ciF4pJ46x1wKg4iE-KwgGLteJk5xl3qH84_eqq4hyBqVTqnY5oRhR6AZ0_MNAwT9AdJMPhwoMWVoeVLmLoIRzC4Prfb4Iv-slqEOeuEf-wNUqXotVeOQEPHx3T-ovXj84Qbj_a7PpKKQnjgpx0ljIXTuyktzfRhDWMC4jCRaGIWZ2v6ioWzd6br9VIqEeX-_hXjxXvBKjrz0rH";
// auth(authCode, true);

// WORK WORK:
processNewTracks();
