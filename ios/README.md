# iOS app (real background/lock-screen playback)

This wraps the site (spotify-rayyan.vercel.app) in a real iOS app using Capacitor, purely to get
the one thing a web page can never get on iOS: the `UIBackgroundModes: audio` entitlement, which
is what actually keeps audio playing when you exit the app or lock the phone. Everything else
(the actual app UI, playback logic, backend) is unchanged - this is just the native shell.

Because the app loads the live site directly (see `server.url` in `capacitor.config.ts`), pushing
normal code changes to `main` shows up automatically next time you open the app - you only need a
new native build when something in `ios/` or `capacitor.config.ts` itself changes.

## Getting the app onto your phone (free, no Apple Developer account)

1. **Get a build.** Every push to `main` that touches `ios/` triggers
   `.github/workflows/build-ios.yml` on a GitHub-hosted Mac and produces an unsigned `Music.ipa`
   under that workflow run's Artifacts. Or trigger it manually from the Actions tab
   ("Build iOS app" → Run workflow) any time you just want a fresh build.
2. **Install SideStore** on your iPhone (sidestore.io) - this is the free tool that signs and
   installs the `.ipa` using your own free Apple ID, and can auto-refresh the 7-day signature in
   the background afterward without needing your computer each time.
3. Download the `Music.ipa` artifact from the GitHub Actions run (on your phone, or airdrop it
   over), and install it through SideStore.

## Note on this specific setup

I configured the Capacitor project and the GitHub Actions build pipeline carefully, based on
Capacitor's standard native project structure (this one uses Swift Package Manager, not
CocoaPods, so no `pod install` step is needed) - but I have no way to actually run Xcode/a real
build in my own environment to verify the CI workflow succeeds end-to-end on the first try. If
the "Build unsigned .app" step in Actions fails, paste me the error log and I'll fix it from
that - Xcode's own build errors are usually specific enough to diagnose blind, I just can't
pre-verify them myself the way I could verify every other fix in this project by actually
building it here.
