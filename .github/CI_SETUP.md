# iOS → TestFlight CI/CD setup

Pushing to `main` builds the app on a free GitHub macOS runner and uploads it to
TestFlight via fastlane. You also trigger it manually from the Actions tab
("iOS TestFlight" → Run workflow).

This is a **one-time setup**. After it's done, deploys are automatic.

## 1. Create an App Store Connect API key

App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**
→ **Team Keys** → generate a key with the **App Manager** role.

- Download the `.p8` file (you only get one chance).
- Note the **Key ID** and the **Issuer ID** (shown above the keys list).

## 2. Create a private repo to hold signing certificates

fastlane `match` stores your distribution certificate + App Store provisioning
profiles (encrypted) in a separate **private** git repo. Create an empty one, e.g.
`ntv317/ios-certs` (must be **private**).

## 3. Generate the certificate + profiles once, locally

This populates the certs repo and also installs the profiles on your Mac, which
fixes local archiving too.

```bash
cd ios
bundle install                       # installs fastlane (uses ios/Gemfile)

export MATCH_GIT_URL="https://github.com/ntv317/ios-certs.git"
export MATCH_PASSWORD="<pick-a-strong-passphrase-remember-it>"
export ASC_KEY_ID="<key id>"
export ASC_ISSUER_ID="<issuer id>"
export ASC_KEY_P8="$(base64 -i /path/to/AuthKey_XXXX.p8)"

bundle exec fastlane match appstore
```

`match` will create the App Store distribution certificate and the App Store
profiles for `io.liftr.app` and `io.liftr.app.watchkitapp`, then push them to the
certs repo.

## 4. Add GitHub repo secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Value |
|---|---|
| `ASC_KEY_ID` | the Key ID from step 1 |
| `ASC_ISSUER_ID` | the Issuer ID from step 1 |
| `ASC_KEY_P8` | output of `base64 -i AuthKey_XXXX.p8` |
| `MATCH_GIT_URL` | `https://github.com/ntv317/ios-certs.git` |
| `MATCH_PASSWORD` | the passphrase you chose in step 3 |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `printf 'USERNAME:PAT' \| base64` — a GitHub PAT with read access to the private certs repo |

For `MATCH_GIT_BASIC_AUTHORIZATION`, create a fine-grained PAT (or classic with
`repo` scope) that can read `ios-certs`, then:

```bash
printf 'ntv317:ghp_yourtoken' | base64
```

## 5. Deploy

```bash
git push origin main
```

Watch it under the repo's **Actions** tab. The build number auto-increments past
the latest TestFlight build, so every push is a fresh TestFlight build.

## Notes

- macOS runner minutes are **free and unlimited** because this repo is public.
- The app version (`MARKETING_VERSION`, currently `1.0`) is not bumped
  automatically — raise it in Xcode when you ship a new version to the App Store.
- CI runs `match` in read-only mode, so it never mints new certificates; if you
  ever need to rotate them, run step 3 again locally.
