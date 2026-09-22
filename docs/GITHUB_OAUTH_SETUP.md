# mPanel — GitHub OAuth setup

mPanel uses Supabase Auth for GitHub sign-in and requests the GitHub `repo`, `read:user`, and `user:email` scopes for the website-management workflow.

## 1. Configure GitHub OAuth in Supabase

Open: Supabase Dashboard → Authentication → Providers → GitHub

Enable GitHub and enter the GitHub OAuth App Client ID and Client Secret.

Supabase provides the callback URL in the provider configuration. For this project it is:

`https://rzlginzjvakxboeacscd.supabase.co/auth/v1/callback`

## 2. Configure the GitHub OAuth App

In GitHub: Settings → Developer settings → OAuth Apps → New OAuth App

Homepage:
`https://gpldroid.github.io/mpanel/`

Authorization callback URL:
`https://rzlginzjvakxboeacscd.supabase.co/auth/v1/callback`

Do not put the GitHub Client Secret in mPanel source code.

## 3. Configure Supabase redirect URLs

Open: Supabase Dashboard → Authentication → URL Configuration

Allow the production mPanel URL:
`https://gpldroid.github.io/mpanel/`

The application sends this URL as `redirectTo` when starting OAuth.

## 4. What happens after login

1. The user clicks **Continue with GitHub**.
2. Supabase redirects to GitHub.
3. GitHub returns to Supabase.
4. Supabase redirects back to mPanel.
5. mPanel restores the Supabase session.
6. The GitHub provider token is available to the GitHub integration in the current browser session.
7. mPanel can read repositories and perform the configured publishing workflow.

The provider token is not written to the mPanel database.

## 5. Required scopes

- `repo` — repository access required for private repositories and repository publishing.
- `read:user` — read the GitHub account identity.
- `user:email` — read the account email when GitHub does not expose it publicly.

## 6. Troubleshooting

### GitHub button returns to the login page
Check that the production mPanel URL is present in Supabase's Redirect URLs list.

### GitHub says redirect URI is incorrect
Check the GitHub OAuth App callback URL. It must be the Supabase Auth callback, not the mPanel GitHub Pages URL.

### OAuth succeeds but repositories do not load
Open the browser console and inspect GitHub integration errors. The GitHub provider must be enabled in Supabase and the OAuth App must have the requested scopes.

### The dashboard does not start
mPanel now includes a boot recovery screen. If the JavaScript application module fails to load, the page shows a recovery message instead of leaving the interface apparently frozen.