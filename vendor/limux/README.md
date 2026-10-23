# Limux (bundled copy)

The official Linux tarball of [Limux](https://github.com/am-will/limux) (MIT, see `LICENSE`),
kept so Settings → "Where sessions open" can still install it when GitHub is unreachable or the
project disappears (`server/services/limuxInstallService.ts`). The installer prefers GitHub's
latest release and only falls back to this copy.

To refresh it: replace `limux-<version>-linux-x86_64.tar.gz` (keep a single tarball here) and put
its line from the release's `SHA256SUMS` in `SHA256SUMS`.
