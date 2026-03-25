// src/providers/google.ts
function GoogleProvider(config) {
  const clientId = config.clientId ?? process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = config.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET ?? "";
  return {
    id: "google",
    name: "Google",
    type: "oauth",
    clientId,
    clientSecret,
    authorization: {
      url: "https://accounts.google.com/o/oauth2/v2/auth",
      params: {
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account",
        ...config.authorization?.params
      }
    },
    token: {
      url: "https://oauth2.googleapis.com/token"
    },
    userinfo: {
      url: "https://www.googleapis.com/oauth2/v2/userinfo"
    },
    profile(profile) {
      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        image: profile.picture
      };
    },
    checks: ["state"],
    scope: "openid email profile"
  };
}
var google_default = GoogleProvider;

export { GoogleProvider, google_default as default };
//# sourceMappingURL=google.js.map
//# sourceMappingURL=google.js.map