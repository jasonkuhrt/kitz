export const getGithubToken = (token: string | undefined): string | undefined =>
  token ?? process.env[`GITHUB_TOKEN`]
