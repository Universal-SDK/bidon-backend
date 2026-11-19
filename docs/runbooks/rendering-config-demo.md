# Rendering config demo

Show the uSDK renderer drawing each ad type through a real auction, then change one
rendering property on the DSP side and watch the next ad change.

The demo app lives in [usdk-android](https://github.com/bidon-io/usdk-android). Its Nix dev
shell provides JDK 21, the Android SDK and an emulator.

```
demo app (emulator) → sdkapi /v2/auction → Adikteev demand → bidon-dspsim
  → seatbid.bid.ext.rendering → ad_units[].ext.rendering → renderer
```

The `--dev` seed points the sample Adikteev account at `bidon-dspsim`, and the Tetris app
(`tetris_2005`, the demo app's default key) bids Adikteev for banner, MREC, interstitial and
rewarded.

## Setup

**1. Backend.** Start the stack so the device reaches dspsim's creative URLs at `localhost`:

```bash
DSPSIM_CREATIVE_URL=http://localhost:1325 just compose
```

`DSPSIM_CREATIVE_URL` moves only the URLs inside the markup (assets, click, impression, VAST
tracking). The nurl/burl/lurl stay on `bidon-dspsim:1325`, because sdkapi fires them from
inside the stack. dspsim's VAST creatives play a public sample video, so the emulator needs
internet access.

The stack also needs `GeoLite2-City.mmdb` in the repo root, as for any `just compose`.

**2. Emulator.** In `usdk-android`:

```bash
direnv allow            # or: nix develop
scripts/demo.sh emulator
```

The first run downloads the SDK and the system image (a few GB) and creates the AVD.

**3. App.** In another shell, in `usdk-android`:

```bash
scripts/demo.sh install
```

This runs `adb reverse` for ports 1324 and 1325 and installs the debug app. Only the debug
build allows plain `http`. On the app's Settings tab, set **Base URL** to
`http://localhost:1324` and tap **Restart app**. Rerun `install` after an emulator restart:
`adb reverse` does not survive it.

## Choosing the ad type

dspsim cannot tell interstitial from rewarded on the wire, and draws a fullscreen creative at
random. Pin the one you want to show; slots it cannot serve, such as banners, keep the
random draw:

```bash
curl -X PUT localhost:1325/debug/creative/adikteev_vast_video          # VAST video
curl -X PUT localhost:1325/debug/creative/adikteev_mraid_interstitial  # MRAID
curl -X DELETE localhost:1325/debug/creative                           # random again
```

`GET localhost:1325/debug/creatives` lists the creatives.

## Script

1. **Every ad type with defaults.** Load and show a banner, an MREC, an MRAID interstitial and
   a VAST rewarded ad. Fullscreen ads get a white ✕ top right, after a 5-second countdown; VAST
   offers "Skip" after 15 seconds.
2. **Flip a property.** Change the rendering config dspsim sends, then load a new ad:

   ```bash
   curl -X PUT localhost:1325/debug/rendering -d '{
     "close_button": {"position": "top_left", "style": "text_close", "delay_seconds": 2}
   }'
   ```

   The next fullscreen ad has a "Close" pill top left after 2 seconds. An ad that already
   loaded keeps its old config.
3. **VAST skip.** Pin `adikteev_vast_video`. dspsim's VAST has no `skipoffset`, so the
   DSP's value applies and "Skip" shows after 3 seconds:

   ```bash
   curl -X PUT localhost:1325/debug/rendering -d '{"container": {"skip_offset_seconds": 3}}'
   ```

4. **Server-side fallback.** Send an invalid value: the whole section falls back to its
   defaults, and sdkapi logs the rejected section.

   ```bash
   curl -X PUT localhost:1325/debug/rendering -d '{
     "close_button": {"position": "top_left", "style": "sparkly"}
   }'
   ```

5. **Back to defaults:** `curl -X DELETE localhost:1325/debug/rendering`, and
   `curl -X DELETE localhost:1325/debug/creative`.

`GET localhost:1325/debug/rendering` shows the current override, and
`GET localhost:1325/debug/bids` shows the `rendering` each bid carried.

## What the renderer acts on

Only these properties change what is on screen; the rest of the
[schema](../architecture/rendered-configuration-schema.md) reaches the device but is ignored.

| Property | Effect |
|---|---|
| `close_button.delay_seconds`, `countdown_visible` | When the button appears, and whether a countdown shows first (max 30 s) |
| `close_button.style` | `icon_x`, `icon_circle`, `text_close` (`custom` falls back to `icon_x`) |
| `close_button.position`, `size_dp`, `color`, `opacity`, `padding_dp` | Placement and look, clamped to keep the button reachable |
| `container.skip_offset_seconds` | VAST skip time when the VAST has no `skipoffset` |

`close_button.visible: false` is ignored: the button is always shown. Banners have no close
button, so a rendering change does not show on them.

## Troubleshooting

- **No fill.** Check `GET localhost:1325/debug/nobids` and the sdkapi logs. Sample data only
  loads with `--dev`, which `just compose` passes to the seed.
- **Banner shows a broken image, or VAST fails to load.** The device cannot reach the creative
  URLs: check `DSPSIM_CREATIVE_URL` and `adb reverse --list`.
- **The emulator window is black or the emulator crashes at start.** It runs with software
  rendering by default; `EMULATOR_GPU=host scripts/demo.sh emulator` tries the host GPU.
