# proto

Protobuf definitions for the Bidon server APIs.

| Directory  | Contents                     | Origin                                                                                             |
|------------|------------------------------|----------------------------------------------------------------------------------------------------|
| `proto/`   | Bidon mediation and services | `bidon-io/bidon-protos` at `07497f3`, added with `git subtree` (history kept)                       |
| `adcom/`   | IAB AdCOM v1                 | [IABTechLab/adcom-proto](https://github.com/IABTechLab/adcom-proto) at `921f85e`, `git subtree --squash` |
| `openrtb/` | IAB OpenRTB v3               | [IABTechLab/openrtb-proto](https://github.com/IABTechLab/openrtb-proto) at `c0de0fc`, `git subtree --squash` |

These are ordinary files in this repo: edit them directly. The modules and
their lint rules are in the root [buf.yaml](../buf.yaml), and Go generation
into `pkg/proto` is in the root [buf.gen.yaml](../buf.gen.yaml). From the
repo root:

```bash
buf lint
buf generate
```

The Rust proxy compiles the same files from [build.rs](../build.rs).

To update a vendored IAB repo:

```bash
git subtree pull --squash --prefix=proto/adcom https://github.com/IABTechLab/adcom-proto.git main
git subtree pull --squash --prefix=proto/openrtb https://github.com/IABTechLab/openrtb-proto.git master
```
