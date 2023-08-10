const { auth } = require("./auth");
const fetch = require("isomorphic-unfetch");
const { sleep } = require("./utils");
const {
  getCachedPlaylist,
  setCachedPlaylist,
  getCachedTrack,
  setCachedTrack,
} = require("./cache");
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

  await sleep(500, 1000);

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
  let playlistPath = `${encodeURIComponent(playlistId)}/tracks`;
  let trackUris = [];

  while (playlistPath) {
    const cached = await getCachedPlaylist(playlistPath);
    let uris = cached?.uris;
    let nextUrl = cached?.next;

    if (!uris) {
      const data = await fetchSpotify("GET", `/playlists/${playlistPath}`);
      uris = (data.items && data.items.map((item) => item.track.uri)) || [];
      nextUrl =
        data.next?.replace("https://api.spotify.com/v1/playlists/", "") || null;
    }

    trackUris = [...trackUris, ...uris];

    // there is next page = this page is already full = will not be modified = can be cached
    if (nextUrl) {
      await setCachedPlaylist(playlistPath, uris, nextUrl);
    }
    playlistPath = nextUrl;
  }

  return trackUris;
};

const findTrack = async (name) => {
  const upperCaseName = name.toUpperCase();
  let uri = await getCachedTrack(upperCaseName);

  if (!uri) {
    const data = await fetchSpotify(
      "GET",
      `/search?type=track&q=${encodeURIComponent(upperCaseName)}`,
    );
    uri =
      data.tracks && data.tracks.items.length > 0
        ? data.tracks.items[0].uri
        : null;
  }

  if (!uri) {
    console.error("Unable to find track:", name);
  }

  await setCachedTrack(upperCaseName, uri);

  return uri;
};

const findAllTracks = async (tracks) => {
  const allTracks = [];
  for (const track of tracks) {
    allTracks.push(await findTrack(track));
  }
  return allTracks;
};

module.exports = {
  addToPlaylist,
  getPlaylistTracks,
  findAllTracks,
};
