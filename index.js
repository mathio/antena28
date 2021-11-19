const fetch = require("isomorphic-unfetch");
const btoa = require("btoa");

const sleep = (ms) => new Promise(res => setTimeout(res, ms))

const getTracks = async (url) => {
	let data = []

	try {
		const response = await fetch(url);
		const result = await response.json();
		data = result && result.data || []
	} catch(e) {
		console.error('Failed while fetching tracks:'. e)
	}

	return data.map(track => {
		const { name, title } = track || {}
		if (name && title) {
			return `${name} - ${title}`
		}
	}).filter(v => !!v);
}

const register = async () => {
	const clientId = process.env.SPOTIFY_CLIENT_ID;
	const redirectUrl = process.env.SPOTIFY_REDIRECT_URL;
	const scopes = "playlist-read-collaborative playlist-modify-private playlist-modify-public playlist-read-private";

	console.log(`https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}` +
				`&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUrl)}`);
};

const auth = async (code, useAuthCode = false) => {
	const auth = useAuthCode ?
		`grant_type=authorization_code&code=${encodeURIComponent(code)}` :
		`grant_type=refresh_token&refresh_token=${encodeURIComponent(code)}`;
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
			"Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`
		},
		body: `redirect_uri=${encodeURIComponent(redirectUrl)}&${auth}`
	});
	const data = await response.json();

	if (useAuthCode) {
		console.log(data);
	} else if (data.refresh_token) {
		console.log("WARNING! New refresh_token supplied:", data.refresh_token);
	}

	return data.access_token;
};

const addToPlaylist = async (accessToken, playlistId, uris, name) => {

	const response = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?uris=${uris.join(",")}`, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${accessToken}`
		}
	});

	const data = await response.json();

	if (data.snapshot_id) {
		console.log(`${name}: ${uris.length} succesfully added to playlist.`)
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

const processRadio886Playlists = async (name, playlistId, accessToken) => {
	const url = `https://meta.radio886.at/${name}`
	const tracks = await getTracks(url);
	const trackUris = await Promise.all(tracks.map(track => findTrack(accessToken, track)));
	const existingTrackUris = await getPlaylistTracks(accessToken, playlistId);
	const newTrackUris = trackUris.filter(uri => !!uri && existingTrackUris.indexOf(uri) === -1);
	if (newTrackUris.length > 0) {
		await addToPlaylist(accessToken, playlistId, newTrackUris, name);
	}
	return newTrackUris
}

const processNewTracks = async () => {
	const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
	const accessToken = await auth(refreshToken);

	const playlists = [
		{
			name: 'HardRock',
			spotifyPlaylistId: '7Ec0rNNvVzASYJ6XaQmc4w',
		},
		{
			name: 'NewRock',
			spotifyPlaylistId: '2VSTBfKYYUbZL3QORXYX7D',
		},
		{
			name: 'ClassicRock',
			spotifyPlaylistId: '77N4roRdtoPPagHdBxjUwd',
		},
		{
			name: '886',
			spotifyPlaylistId: '1xv0WP1QQKYTeUN3LJ9UEy',
		},
	]

	const spotifyPlaylistIdAllSongs = '2ADUOTr9QaI0sjBSXpyCTF'
	let trackUris = []

	for(let i = 0; i < playlists.length; i += 1) {
		const { name, spotifyPlaylistId } = playlists[i]
		const addedTrackUris = await processRadio886Playlists(name, spotifyPlaylistId, accessToken)
		trackUris = [ ...trackUris, ...addedTrackUris ]
		await sleep(1000 + Math.random() * 4000)
	}

	const existingTrackUris = await getPlaylistTracks(accessToken, spotifyPlaylistIdAllSongs);
	const newTrackUris = trackUris.filter(uri => !!uri && existingTrackUris.indexOf(uri) === -1);
	if (newTrackUris.length > 0) {
		await addToPlaylist(accessToken, spotifyPlaylistIdAllSongs, newTrackUris, 'All');
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
// const authCode = "AQDbKFXQIGb3iaroiOMPL0WP1wrrNpLhhEkOuTu7FeGQLbM6X4Rhj98snMFjCIBr3_paZrBcm7I_ghU47ec76bPgWYteA2F5-XejzjUMpwg7BjPi2J5h2c-BRBeVNTSV7_SMQTNFirhx0iPNZTRIBgXTrQEYghElBABaJF4Rq4gEcoLFoKuB7Vf51dNVLmZoNncf3CbVqv_DchPGrWVVdbPgEocc9UB2PLqOfxDpwU5ffV9GmhChdTLRNBlWIWXFih5CbHc__Dt-VeEzsc7jwbOEHx9YCmbSwsvfB928XpIRxn5IxPmcYZvuZoac";
// auth(authCode, true);

// WORK WORK:
processNewTracks();

