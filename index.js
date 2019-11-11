const https = require("https");
const fetch = require("isomorphic-unfetch");
const btoa = require("btoa");

const fixAccents = (value) => {
	const replace = {
		"Ã¡": "á",
		"Å ": "Š",
		"&amp;": "&",
	};
	let newValue = value;
	for (let i = 0; i < Object.keys(replace).length; i += 1) {
		const key = Object.keys(replace)[i];
		newValue = newValue.replace(key, replace[key]);
	}
	return newValue;
};

const getAntenaTracks = async () => {

	const response = await fetch("https://www.antenarock.sk/playlist-hranych-skladieb");
	const data = await response.text();

	const matches = data.match(/\<h3 class="title"\>(.*)-(.*)\<\/h3\>/g).map(item => {
		const [_wholeMatch, artist, song] = item.match(/\<h3 class="title"\>\s*(.*)\s*-\s*(.*)\s*\<\/h3\>/);
		return fixAccents(`${artist} - ${song}`);
	});

	// console.log(matches);

	return matches.reverse();
}

const register = async () => {
	const clientId = process.env.SPOTIFY_CLIENT_ID;
	const redirectUrl = process.env.SPOTIFY_REDIRECT_URL;
	const scopes = "playlist-read-collaborative playlist-modify-private playlist-modify-public playlist-read-private";

	console.log(`https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}` + 
				`&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUrl)}`);
};

// 1. call register() to get login link and open it in browser
// 2. authorize the app for your spotify account in browser
// 3. you wil be redirected to non-existing URL with "code" parameter in query
// 4. paste the "code" value below to "authCode" variable
const authCode = "";

const auth = async (code, useAuthCode = false) => {
	const auth = useAuthCode ? 
		`grant_type=authorization_code&code=${encodeURIComponent(code)}` :
		`grant_type=refresh_token&refresh_token=${encodeURIComponent(code)}`;
	const clientId = process.env.SPOTIFY_CLIENT_ID;
	const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
	const redirectUrl = process.env.SPOTIFY_REDIRECT_URL;

	// console.log(auth);

	const response = await fetch("https://accounts.spotify.com/api/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`
		},
		body: `redirect_uri=${encodeURIComponent(redirectUrl)}&${auth}`
	});
	const data = await response.json();

	// console.log(data);

	if (data.refresh_token) {
		console.log("WARNING! New refresh_token supplied:", data.refresh_token);
	}

	return data.access_token;
};

const addToPlaylist = async (accessToken, playlistId, uris) => {

	const response = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?uris=${uris.join(",")}`, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${accessToken}`
		}
	});
	const data = await response.json();

	if (data.snapshot_id) {
		console.log(`${uris.length} succesfully added to playlist.`)
	} else {
		console.error("Error adding tracks:", data);
	}
};

const getPlaylistTracks = async (accessToken, playlistId) => {

	let playlistUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`;
	let trackUris = [];

	while (playlistUrl) {
		const response = await fetch(playlistUrl, {
			headers: {
				"Authorization": `Bearer ${accessToken}`
			}
		});
		const data = await response.json();
		const uris = data.items && data.items.map(item => item.track.uri) || [];
		trackUris = [...trackUris, ...uris];
		playlistUrl = data.next;
	}

	// console.log(trackUris);

	return trackUris;
};

const findTrack = async (accessToken, name) => {
	const response = await fetch(`https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(name)}`, {
		headers: {
			"Authorization": `Bearer ${accessToken}`
		},
	});
	const data = await response.json();

	const uri = data.tracks && data.tracks.items.length > 0 ? data.tracks.items[0].uri : null;
	
	// console.log({name, uri});

	if (!uri) {
		console.error("Unable to find track:", name);
	}

	return uri;
};

const processAntena = async () => {
	const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
	const playlistId = "1tQYooYArM41TiFO5cHbXo";	// spotify id of "Antena" playlist
	const accessToken = await auth(refreshToken);

	const tracks = await getAntenaTracks();
	const trackUris = await Promise.all(tracks.map(track => findTrack(accessToken, track)));
	const existingTrackUris = await getPlaylistTracks(accessToken, playlistId);
	const newTrackUris = trackUris.filter(uri => !!uri && existingTrackUris.indexOf(uri) === -1);
	if (newTrackUris.length > 0) {
		await addToPlaylist(accessToken, playlistId, newTrackUris);
	}
};

// register();
// auth(authCode);
processAntena();

