# Twitlabel

A Chrome extension that marks X (Twitter) accounts based outside your home country, so you can see at a glance when a reply comes from somewhere else.

- **Alien account** (solid pill): X lists the account as based outside your home country. Click the pill to see the country.
- **Possibly alien** (outline pill): the account is listed outside your home country, but X has tagged that location as unreliable.
- Accounts in your home country, and accounts with no location on X, get no pill.

Other extensions put a country flag on every account. This one marks only the accounts outside your home country and keeps the ones X itself is unsure about separate.

## Install

The extension is not in the Chrome Web Store. You load it yourself, which takes about a minute.

1. On this page, click **Code**, then **Download ZIP**.
2. Unzip the file. You get a folder.
3. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder (the one that contains `manifest.json`). Select the folder itself, not the zip.
5. Open x.com while signed in and scroll.

Keep the folder where it is. Chrome reads the extension from that location.

It also works in other Chromium browsers such as Edge and Brave. It does not work in the X mobile app.

## Settings

Click the extension's icon to:

- turn the pills on or off
- change your home country (it is set from your computer's time zone the first time)
- clear the saved locations

US territories (Puerto Rico, Guam, the US Virgin Islands, American Samoa, the Northern Mariana Islands) count as home when your home country is United States.

## How it works

X shows where an account is based on its "About this account" page. The extension asks X for that same information for each account that appears on your screen, using your own signed-in session, and adds the pill when the country differs from yours.

Results are saved in your browser for 30 days so the same account is not looked up twice.

## Privacy

- Nothing is sent anywhere except to X itself.
- No analytics, no tracking, no outside servers.
- Settings and saved locations stay in your browser's extension storage.

## Limits you should know about

- **The location is X's, not ours.** The pill repeats what X lists. X's data can be wrong, and people travel, live abroad, or use VPNs. A pill says where X lists the account, not who the person is or why they are posting.
- **It uses a lookup X does not offer publicly.** X can change it at any time, which will stop the pills until the extension is updated. The lookups run from your own account; use it at your own discretion.
- **Pills fill in gradually.** X limits how many lookups it allows. On a busy thread, pills appear over time, and the settings popup tells you when lookups are paused.
- **No automatic updates.** To update, download the ZIP again, replace the folder's contents, and click the reload arrow on `chrome://extensions`.

## Not affiliated with X

This is an independent project. It is not affiliated with, endorsed by, or connected to X Corp.

## License

MIT. See `LICENSE`.
