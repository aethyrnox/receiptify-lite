const clientId = "489e0479f85e42548d4dcaddcd0d3dfb";
const redirectUri = "https://receiptynox.netlify.app";
const scopes = "user-top-read";

function base64encode(str) {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64encode(digest);
}

function generateRandomString(length) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function authorizeSpotify() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);

  localStorage.setItem("code_verifier", codeVerifier);

  const args = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  window.location = "https://accounts.spotify.com/authorize?" + args;
}

async function handleRedirect() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) return;

  const codeVerifier = localStorage.getItem("code_verifier");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body
  });

  const data = await response.json();
  if (data.access_token) {
    localStorage.setItem("access_token", data.access_token);
    window.history.replaceState({}, document.title, "/receiptify-lite/");
    getTopTracks(data.access_token);
  } else {
    alert("Token exchange failed.");
  }
}

function logout() {
  localStorage.removeItem("access_token");
  window.location.href = "https://receiptynox.netlify.app";
}

function generateOrderId() {
  return Math.floor(1000 + Math.random() * 9000);
}

function downloadReceipt() {
  const receipt = document.getElementById("receipt-content");
  html2canvas(receipt).then(canvas => {
    const link = document.createElement("a");
    link.download = "music_receipt.png";
    link.href = canvas.toDataURL();
    link.click();
  });
}

function getTopTracks(token) {
  document.getElementById("auth").style.display = "none";
  document.getElementById("receipt").style.display = "block";
  document.getElementById("order-id").innerText = generateOrderId();

  fetch("https://api.spotify.com/v1/me/top/tracks?limit=10", {
    headers: {
      Authorization: "Bearer " + token
    }
  })
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById("track-list");
      list.innerHTML = "";
      data.items.forEach((track, index) => {
        const li = document.createElement("li");
        li.textContent = `${index + 1}. ${track.name} - ${track.artists[0].name}`;
        list.appendChild(li);
      });
    });
}

window.onload = () => {
  const token = localStorage.getItem("access_token");
  if (token) {
    getTopTracks(token);
  } else {
    handleRedirect();
  }
};
