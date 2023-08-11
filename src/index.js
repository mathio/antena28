const { extractTracks, extractors } = require("./extract");
const {
  findAllTracks,
  getPlaylistTracks,
  addToPlaylist,
} = require("./spotify");
const { disconnectMongoCache } = require("./cache");
// const { register, auth } = require("./auth");

const processRadioPlaylists = async ({
  url,
  spotifyPlaylistId,
  extractor,
  asJson = true,
}) => {
  const tracks = await extractTracks(url, extractor, asJson);
  if (!tracks || tracks.length === 0) {
    return [];
  }
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
    {
      url: "https://radia.cz/radio-rock-radio-playlist",
      spotifyPlaylistId: "30swlxgIhoxh0LwvCkQAX0",
      extractor: extractors.mapRadiaCz,
      asJson: false,
    },
    {
      url: "https://radia.cz/radio-rock-radio-hard-and-heavy-playlist",
      spotifyPlaylistId: "03yOcLoXoV2iGywFEARoqQ",
      extractor: extractors.mapRadiaCz,
      asJson: false,
    },
  ];

  for (let i = 0; i < playlists.length; i += 1) {
    await processRadioPlaylists(playlists[i]);
  }

  await disconnectMongoCache();
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
