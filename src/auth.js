const fetch = require("isomorphic-unfetch");
const btoa = require("btoa");
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

module.exports = {
  register,
  auth,
};
