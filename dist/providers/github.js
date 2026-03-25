// src/providers/github.ts
function GitHubProvider(config) {
  const clientId = config.clientId ?? process.env.GITHUB_CLIENT_ID ?? "";
  const clientSecret = config.clientSecret ?? process.env.GITHUB_CLIENT_SECRET ?? "";
  return {
    id: "github",
    name: "GitHub",
    type: "oauth",
    clientId,
    clientSecret,
    authorization: {
      url: "https://github.com/login/oauth/authorize",
      params: {
        response_type: "code",
        scope: "read:user user:email",
        ...config.authorization?.params
      }
    },
    token: {
      url: "https://github.com/login/oauth/access_token"
    },
    userinfo: {
      url: "https://api.github.com/user"
    },
    profile(profile) {
      return {
        id: String(profile.id),
        name: profile.name ?? profile.login,
        email: profile.email,
        image: profile.avatar_url
      };
    },
    checks: ["state"],
    scope: "read:user user:email"
  };
}
var github_default = GitHubProvider;

export { GitHubProvider, github_default as default };
//# sourceMappingURL=github.js.map
//# sourceMappingURL=github.js.map